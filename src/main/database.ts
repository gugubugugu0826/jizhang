// ============================================================
// 记账APP v2 — SQLite 数据库层
// ============================================================
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { Expense, NewExpense, ExpenseItem, NewExpenseItem, Person, ExchangeRate, Currency, Category } from '../shared/types'
import { SYSTEM_CATEGORIES } from '../shared/categories'

let db: Database.Database

// ============================================================
// 迁移
// ============================================================

function migrateIfNeeded(): void {
  // 检查旧 expenses 表是否需要迁移
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'").get() as { sql: string } | undefined
  if (tableInfo && !tableInfo.sql.includes('currency')) {
    // 旧表结构，删除并重建
    db.exec('DROP TABLE IF EXISTS expenses')
  }
}

// ============================================================
// 初始化
// ============================================================

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'jizhang.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 检测旧表并迁移
  migrateIfNeeded()

  // 创建人员表
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 创建花销总表
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency TEXT NOT NULL DEFAULT 'CNY',
      total_amount INTEGER NOT NULL,
      category1 TEXT NOT NULL,
      category2 TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 创建分摊明细表
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      person_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT DEFAULT '',
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id)
    )
  `)

  // 创建汇率表
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category1 ON expenses(category1);
    CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON expense_items(expense_id);
    CREATE INDEX IF NOT EXISTS idx_expense_items_person ON expense_items(person_id);
  `)

  // 设置表（用于存储 API Key 等）
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // 欠款/结余记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS balance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      note TEXT DEFAULT '',
      expense_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (person_id) REFERENCES people(id)
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_balance_person ON balance_records(person_id, currency)`)

  // 创建分类表
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      parent_id TEXT,
      is_system INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `)

  // 种子数据
  seedData()
}

function seedData(): void {
  const personCount = (db.prepare('SELECT COUNT(*) as c FROM people').get() as { c: number }).c
  if (personCount === 0) {
    const insertPerson = db.prepare('INSERT INTO people (name) VALUES (?)')
    for (const name of ['廖泽平', '黄柏清', '张先澍', '刘承洲']) {
      insertPerson.run(name)
    }
  }

  const rateCount = (db.prepare('SELECT COUNT(*) as c FROM exchange_rates').get() as { c: number }).c
  if (rateCount === 0) {
    db.prepare('INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES (?, ?, ?)').run('AUD', 'CNY', 4.8)
  }

  // API Key 由用户自行配置，不预置
  // 用户可在「智能录入」→「配置 API」中设置自己的 Key

  // 种子系统分类
  const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c
  if (catCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (id, name, icon, parent_id, is_system, sort_order) VALUES (?, ?, ?, ?, 1, ?)'
    )
    let sortIdx = 0
    for (const main of SYSTEM_CATEGORIES) {
      insertCat.run(main.id, main.name, main.icon, null, sortIdx++)
      for (const sub of main.children) {
        insertCat.run(sub.id, sub.name, '', main.id, sortIdx++)
      }
    }
  }
}

// ============================================================
// 人员 CRUD
// ============================================================

export function getPeople(): Person[] {
  return db.prepare('SELECT id, name, created_at as createdAt FROM people ORDER BY id').all() as Person[]
}

export function addPerson(name: string): Person {
  const result = db.prepare('INSERT INTO people (name) VALUES (?)').run(name)
  return db.prepare('SELECT id, name, created_at as createdAt FROM people WHERE id = ?').get(result.lastInsertRowid) as Person
}

export function updatePerson(id: number, name: string): Person | undefined {
  db.prepare('UPDATE people SET name = ? WHERE id = ?').run(name, id)
  return db.prepare('SELECT id, name, created_at as createdAt FROM people WHERE id = ?').get(id) as Person | undefined
}

export function deletePerson(id: number): boolean {
  // 先清理该人员关联的数据
  db.prepare('DELETE FROM expense_items WHERE person_id = ?').run(id)
  db.prepare('DELETE FROM balance_records WHERE person_id = ?').run(id)
  const result = db.prepare('DELETE FROM people WHERE id = ?').run(id)
  return result.changes > 0
}

// ============================================================
// 花销 CRUD
// ============================================================

export function addExpense(expense: NewExpense): Expense {
  const totalAmount = expense.items.reduce((sum, item) => sum + item.amount, 0)

  const result = db.prepare(`
    INSERT INTO expenses (currency, total_amount, category1, category2, date, note)
    VALUES (@currency, @totalAmount, @category1, @category2, @date, @note)
  `).run({
    currency: expense.currency,
    totalAmount,
    category1: expense.category1,
    category2: expense.category2,
    date: expense.date,
    note: expense.note
  })

  const expenseId = Number(result.lastInsertRowid)

  const insertItem = db.prepare(`
    INSERT INTO expense_items (expense_id, person_id, amount, note)
    VALUES (@expense_id, @person_id, @amount, @note)
  `)

  const balanceItems: { personId: number; amount: number }[] = []
  for (const item of expense.items) {
    insertItem.run({
      expense_id: expenseId,
      person_id: item.personId,
      amount: item.amount,
      note: item.note
    })
    balanceItems.push({ personId: item.personId, amount: item.amount })
  }

  // 自动记入欠款
  recordExpenseToBalance(expenseId, balanceItems, expense.currency)

  return getExpenseById(expenseId)!
}

export function getExpenseById(id: number): Expense | undefined {
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as RawExpense | undefined
  if (!row) return undefined
  const items = getExpenseItems(id)
  return mapExpense(row, items)
}

export function getExpenses(params?: {
  currency?: Currency
  personId?: number
  category1?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): { expenses: Expense[]; total: number } {
  let where = 'WHERE 1=1'
  const args: Record<string, string | number> = {}

  if (params?.currency) {
    where += ' AND currency = @currency'
    args.currency = params.currency
  }
  if (params?.category1) {
    where += ' AND category1 = @category1'
    args.category1 = params.category1
  }
  if (params?.startDate) {
    where += ' AND date >= @startDate'
    args.startDate = params.startDate
  }
  if (params?.endDate) {
    where += ' AND date <= @endDate'
    args.endDate = params.endDate
  }

  // 按人员筛选：子查询
  if (params?.personId) {
    where += ` AND id IN (SELECT DISTINCT expense_id FROM expense_items WHERE person_id = @personId)`
    args.personId = params.personId
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM expenses ${where}`).get(args) as { total: number }
  const total = countRow.total

  const limit = params?.limit ?? 50
  const offset = params?.offset ?? 0

  const rows = db
    .prepare(`SELECT * FROM expenses ${where} ORDER BY date DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...args, limit, offset }) as RawExpense[]

  const expenses = rows.map(row => {
    const items = getExpenseItems(row.id)
    return mapExpense(row, items)
  })

  return { expenses, total }
}

export function updateExpense(id: number, updates: {
  currency?: Currency
  category1?: string
  category2?: string
  date?: string
  note?: string
  items?: NewExpenseItem[]
}): Expense | undefined {
  const fields: string[] = []
  const args: Record<string, string | number> = { id }

  if (updates.currency !== undefined) { fields.push('currency = @currency'); args.currency = updates.currency }
  if (updates.category1 !== undefined) { fields.push('category1 = @category1'); args.category1 = updates.category1 }
  if (updates.category2 !== undefined) { fields.push('category2 = @category2'); args.category2 = updates.category2 }
  if (updates.date !== undefined) { fields.push('date = @date'); args.date = updates.date }
  if (updates.note !== undefined) { fields.push('note = @note'); args.note = updates.note }

  if (fields.length > 0) {
    db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = @id`).run(args)
  }

  if (updates.items) {
    const newTotal = updates.items.reduce((sum, item) => sum + item.amount, 0)
    db.prepare('UPDATE expenses SET total_amount = ? WHERE id = ?').run(newTotal, id)
    db.prepare('DELETE FROM expense_items WHERE expense_id = ?').run(id)
    // 删除旧的欠款记录，重新生成
    db.prepare('DELETE FROM balance_records WHERE expense_id = ?').run(id)
    const insertItem = db.prepare('INSERT INTO expense_items (expense_id, person_id, amount, note) VALUES (?, ?, ?, ?)')
    const balanceItems: { personId: number; amount: number }[] = []
    for (const item of updates.items) {
      insertItem.run(id, item.personId, item.amount, item.note)
      balanceItems.push({ personId: item.personId, amount: item.amount })
    }
    // 重新写入欠款记录（使用新的 currency 如果有的话）
    const cur = updates.currency || (db.prepare('SELECT currency FROM expenses WHERE id = ?').get(id) as any)?.currency || 'CNY'
    for (const bi of balanceItems) {
      db.prepare('INSERT INTO balance_records (person_id, currency, amount, type, expense_id) VALUES (?, ?, ?, ?, ?)')
        .run(bi.personId, cur, bi.amount, 'expense', id)
    }
  }

  return getExpenseById(id)
}

export function deleteExpense(id: number): boolean {
  // 先删关联的欠款记录
  db.prepare('DELETE FROM balance_records WHERE expense_id = ?').run(id)
  const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  return result.changes > 0
}

export function deleteExpenses(ids: number[]): number {
  if (ids.length === 0) return 0
  const placeholders = ids.map(() => '?').join(',')
  // 先删关联的欠款记录
  db.prepare(`DELETE FROM balance_records WHERE expense_id IN (${placeholders})`).run(...ids)
  const result = db.prepare(`DELETE FROM expenses WHERE id IN (${placeholders})`).run(...ids)
  return result.changes
}

export function deleteAllExpenses(): number {
  const count = (db.prepare('SELECT COUNT(*) as c FROM expenses').get() as { c: number }).c
  // 删除所有花销类型的欠款记录
  db.exec("DELETE FROM balance_records WHERE type = 'expense'")
  db.exec('DELETE FROM expenses')
  return count
}

// ============================================================
// 统计
// ============================================================

export function getCategoryStats(params?: {
  currency?: Currency
  startDate?: string
  endDate?: string
}): { category1: string; totalAmount: number; count: number }[] {
  let where = 'WHERE 1=1'
  const args: Record<string, string> = {}

  if (params?.currency) { where += ' AND currency = @currency'; args.currency = params.currency }
  if (params?.startDate) { where += ' AND date >= @startDate'; args.startDate = params.startDate }
  if (params?.endDate) { where += ' AND date <= @endDate'; args.endDate = params.endDate }

  return db.prepare(`
    SELECT category1, SUM(total_amount) as totalAmount, COUNT(*) as count
    FROM expenses ${where}
    GROUP BY category1 ORDER BY totalAmount DESC
  `).all(args) as { category1: string; totalAmount: number; count: number }[]
}

export function getMonthlyStats(params?: {
  currency?: Currency
  startMonth?: string
  endMonth?: string
}): { month: string; totalAmount: number; count: number }[] {
  let where = 'WHERE 1=1'
  const args: Record<string, string> = {}

  if (params?.currency) { where += ' AND currency = @currency'; args.currency = params.currency }
  if (params?.startMonth) { where += ' AND strftime(\'%Y-%m\', date) >= @startMonth'; args.startMonth = params.startMonth }
  if (params?.endMonth) { where += ' AND strftime(\'%Y-%m\', date) <= @endMonth'; args.endMonth = params.endMonth }

  return db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(total_amount) as totalAmount, COUNT(*) as count
    FROM expenses ${where}
    GROUP BY month ORDER BY month DESC
  `).all(args) as { month: string; totalAmount: number; count: number }[]
}

export function getPersonStats(params?: {
  currency?: Currency
  startDate?: string
  endDate?: string
}): { personId: number; personName: string; totalAmount: number; count: number }[] {
  let where = 'WHERE 1=1'
  const args: Record<string, string> = {}

  if (params?.currency) { where += ' AND e.currency = @currency'; args.currency = params.currency }
  if (params?.startDate) { where += ' AND e.date >= @startDate'; args.startDate = params.startDate }
  if (params?.endDate) { where += ' AND e.date <= @endDate'; args.endDate = params.endDate }

  return db.prepare(`
    SELECT ei.person_id as personId, p.name as personName,
           SUM(ei.amount) as totalAmount, COUNT(DISTINCT ei.expense_id) as count
    FROM expense_items ei
    JOIN expenses e ON e.id = ei.expense_id
    JOIN people p ON p.id = ei.person_id
    ${where}
    GROUP BY ei.person_id ORDER BY totalAmount DESC
  `).all(args) as { personId: number; personName: string; totalAmount: number; count: number }[]
}

// ============================================================
// 汇率
// ============================================================

export function getLatestRate(from: Currency, to: Currency): ExchangeRate | undefined {
  return db.prepare(`
    SELECT id, from_currency as fromCurrency, to_currency as toCurrency, rate, created_at as createdAt
    FROM exchange_rates
    WHERE from_currency = ? AND to_currency = ?
    ORDER BY id DESC LIMIT 1
  `).get(from, to) as ExchangeRate | undefined
}

export function setExchangeRate(from: Currency, to: Currency, rate: number): ExchangeRate {
  const result = db.prepare(`
    INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES (?, ?, ?)
  `).run(from, to, rate)
  return db.prepare(`
    SELECT id, from_currency as fromCurrency, to_currency as toCurrency, rate, created_at as createdAt
    FROM exchange_rates WHERE id = ?
  `).get(result.lastInsertRowid) as ExchangeRate
}

// ============================================================
// 批量导入（智能录入用）
// ============================================================

export function addExpenses(expenses: NewExpense[]): Expense[] {
  return expenses.map(e => addExpense(e))
}

// ============================================================
// 欠款/结余
// ============================================================

/** 在某笔花销入库后，自动生成 balance_record */
function recordExpenseToBalance(expenseId: number, items: { personId: number; amount: number }[], currency: Currency): void {
  const stmt = db.prepare('INSERT INTO balance_records (person_id, currency, amount, type, expense_id, note) VALUES (?, ?, ?, ?, ?, ?)')
  for (const item of items) {
    // 正数表示这个人欠我（需要付给我），即他该付的金额
    stmt.run(item.personId, currency, item.amount, 'expense', expenseId, '')
  }
}

/** 获取某人当前欠款余额（正数=欠我，负数=我欠） */
export function getPersonBalance(personId: number, currency: Currency): number {
  const row = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM balance_records WHERE person_id = ? AND currency = ?'
  ).get(personId, currency) as { total: number }
  return row.total
}

/** 获取所有人欠款余额 */
export function getAllBalances(currency: Currency): { personId: number; personName: string; balance: number }[] {
  return db.prepare(`
    SELECT p.id as personId, p.name as personName, COALESCE(SUM(br.amount), 0) as balance
    FROM people p
    LEFT JOIN balance_records br ON br.person_id = p.id AND br.currency = ?
    GROUP BY p.id
    ORDER BY balance DESC
  `).all(currency) as { personId: number; personName: string; balance: number }[]
}

/** 手动录入欠款/借款 */
export function addManualBalance(personId: number, currency: Currency, amount: number, note: string): void {
  // positive amount = person owes me (I paid for them)
  // negative amount = I owe person (I borrowed)
  db.prepare('INSERT INTO balance_records (person_id, currency, amount, type, note) VALUES (?, ?, ?, ?, ?)')
    .run(personId, currency, amount, 'manual', note)
}

/** 一键清账（插入抵消记录） */
export function settlePerson(personId: number, currency: Currency): number {
  const current = getPersonBalance(personId, currency)
  if (current === 0) return 0
  // 插入一条负的当前余额，归零
  db.prepare('INSERT INTO balance_records (person_id, currency, amount, type, note) VALUES (?, ?, ?, ?, ?)')
    .run(personId, currency, -current, 'settle', '清账')
  return -current
}

/** 删除一条欠款记录 */
export function deleteBalanceRecord(id: number): boolean {
  const result = db.prepare('DELETE FROM balance_records WHERE id = ?').run(id)
  return result.changes > 0
}

/** 获取欠款历史记录 */
export function getBalanceHistory(params?: {
  personId?: number
  currency?: Currency
  type?: string
  startDate?: string
  endDate?: string
  limit?: number
}): any[] {
  let where = 'WHERE 1=1'
  const args: Record<string, any> = {}
  if (params?.personId) { where += ' AND br.person_id = @personId'; args.personId = params.personId }
  if (params?.currency) { where += ' AND br.currency = @currency'; args.currency = params.currency }
  if (params?.type) { where += ' AND br.type = @type'; args.type = params.type }
  if (params?.startDate) { where += ' AND br.created_at >= @startDate'; args.startDate = params.startDate }
  if (params?.endDate) { where += ' AND br.created_at <= @endDate'; args.endDate = params.endDate }
  const limit = params?.limit ?? 200
  return db.prepare(`
    SELECT br.*, p.name as personName
    FROM balance_records br
    JOIN people p ON p.id = br.person_id
    ${where}
    ORDER BY br.created_at DESC
    LIMIT @limit
  `).all({ ...args, limit })
}

// ============================================================
// 关闭
// ============================================================

export function closeDatabase(): void {
  if (db) db.close()
}

// ============================================================
// 设置
// ============================================================

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

// ============================================================
// 分类 CRUD
// ============================================================

interface DbCategory {
  id: string
  name: string
  icon: string
  parent_id: string | null
  is_system: number
  sort_order: number
}

export function getAllCategories(): Category[] {
  const rows = db.prepare(
    'SELECT * FROM categories ORDER BY is_system DESC, sort_order, id'
  ).all() as DbCategory[]

  const mainRows = rows.filter(r => r.parent_id === null)
  return mainRows.map(m => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    isSystem: m.is_system === 1,
    children: rows
      .filter(r => r.parent_id === m.id)
      .map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon || undefined,
        isSystem: c.is_system === 1
      }))
  }))
}

export function getCategoryById(id: string): DbCategory | undefined {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as DbCategory | undefined
}

export function addCategory(name: string, icon: string, parentId: string | null): { success: boolean; category?: DbCategory; error?: string } {
  const id = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)

  if (parentId !== null) {
    const parent = getCategoryById(parentId)
    if (!parent) return { success: false, error: '父分类不存在' }
  }

  db.prepare(
    'INSERT INTO categories (id, name, icon, parent_id, is_system, sort_order) VALUES (?, ?, ?, ?, 0, 99)'
  ).run(id, name, icon, parentId)

  const cat = getCategoryById(id)
  return { success: true, category: cat }
}

export function updateCategory(id: string, name: string, icon?: string): { success: boolean; error?: string } {
  const cat = getCategoryById(id)
  if (!cat) return { success: false, error: '分类不存在' }
  if (cat.is_system) return { success: false, error: '系统分类不可编辑' }

  if (icon !== undefined) {
    db.prepare('UPDATE categories SET name = ?, icon = ? WHERE id = ?').run(name, icon, id)
  } else {
    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id)
  }
  return { success: true }
}

export function deleteCategory(id: string): { success: boolean; error?: string } {
  const cat = getCategoryById(id)
  if (!cat) return { success: false, error: '分类不存在' }
  if (cat.is_system) return { success: false, error: '系统分类不可删除' }

  // 用事务包裹检查+删除，防止 TOCTOU 竞态
  const begin = db.prepare('BEGIN IMMEDIATE')
  const commit = db.prepare('COMMIT')
  const rollback = db.prepare('ROLLBACK')

  try {
    begin.run()

    if (cat.parent_id === null) {
      // 删除大类：先检查自身和子类的花销引用
      const mainUsage = db.prepare(
        'SELECT COUNT(*) as c FROM expenses WHERE category1 = ?'
      ).get(id) as { c: number }
      if (mainUsage.c > 0) {
        rollback.run()
        return { success: false, error: `有 ${mainUsage.c} 条花销记录使用了该大类，无法删除` }
      }

      const children = db.prepare(
        'SELECT id FROM categories WHERE parent_id = ?'
      ).all(id) as { id: string }[]

      for (const child of children) {
        const childUsage = db.prepare(
          'SELECT COUNT(*) as c FROM expenses WHERE category2 = ?'
        ).get(child.id) as { c: number }
        if (childUsage.c > 0) {
          rollback.run()
          return { success: false, error: `子分类有 ${childUsage.c} 条花销记录，无法删除主分类` }
        }
      }

      db.prepare('DELETE FROM categories WHERE parent_id = ?').run(id)
    } else {
      // 删除小类
      const usage = db.prepare(
        'SELECT COUNT(*) as c FROM expenses WHERE category2 = ?'
      ).get(id) as { c: number }
      if (usage.c > 0) {
        rollback.run()
        return { success: false, error: `有 ${usage.c} 条花销记录使用了该小类，无法删除` }
      }
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    commit.run()
    return { success: true }
  } catch (err: any) {
    try { rollback.run() } catch {}
    return { success: false, error: `删除失败：${err.message || err}` }
  }
}

export function getCategoryInfo(cat1: string, cat2: string): {
  category1Name: string
  category1Icon: string
  category2Name: string
} | null {
  const c1 = getCategoryById(cat1)
  if (!c1) return null
  const c2 = getCategoryById(cat2)
  if (!c2) return null
  return {
    category1Name: c1.name,
    category1Icon: c1.icon,
    category2Name: c2.name
  }
}

// ============================================================
// 内部辅助
// ============================================================

interface RawExpense {
  id: number
  currency: string
  total_amount: number
  category1: string
  category2: string
  date: string
  note: string
  created_at: string
}

interface RawExpenseItem {
  id: number
  expense_id: number
  person_id: number
  amount: number
  note: string
  person_name?: string
}

function getExpenseItems(expenseId: number): ExpenseItem[] {
  const rows = db.prepare(`
    SELECT ei.id, ei.expense_id as expenseId, ei.person_id as personId,
           ei.amount, ei.note, p.name as personName
    FROM expense_items ei
    LEFT JOIN people p ON p.id = ei.person_id
    WHERE ei.expense_id = ?
    ORDER BY ei.id
  `).all(expenseId) as ExpenseItem[]
  return rows
}

function mapExpense(row: RawExpense, items: ExpenseItem[]): Expense {
  return {
    id: row.id,
    currency: row.currency as Currency,
    totalAmount: row.total_amount,
    category1: row.category1,
    category2: row.category2,
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
    items
  }
}
