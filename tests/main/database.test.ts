// ============================================================
// database.ts — SQLite 数据库 CRUD + 统计 单元测试
// ============================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// 创建一个临时目录用于存放测试数据库文件
const testDir = mkdtempSync(join(tmpdir(), 'jizhang-test-'))

// 在导入 database 之前 mock electron
vi.mock('electron', () => ({
  app: {
    getPath: () => testDir
  }
}))

// 现在导入被测试的模块
import {
  initDatabase,
  closeDatabase,
  getPeople,
  addPerson,
  updatePerson,
  deletePerson,
  addExpense,
  getExpenses,
  deleteExpense,
  deleteAllExpenses,
  getCategoryStats,
  getMonthlyStats,
  getPersonStats,
  setExchangeRate,
  getLatestRate,
  getAllBalances,
  getPersonBalance,
  addManualBalance,
  settlePerson,
  getBalanceHistory,
  deleteBalanceRecord,
  getSetting,
  setSetting,
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getCategoryInfo
} from '../../src/main/database'

import type { NewExpense } from '../../src/shared/types'

describe('database.ts', () => {
  beforeAll(() => {
    // 初始化数据库（会在 testDir 下创建 jizhang.db）
    initDatabase()
  })

  afterAll(() => {
    closeDatabase()
    // 清理测试目录
    try { rmSync(testDir, { recursive: true, force: true }) } catch {}
  })

  // 每次测试前重置数据（删除数据库文件并重新 init）
  beforeEach(() => {
    closeDatabase()
    try { rmSync(join(testDir, 'jizhang.db'), { force: true }) } catch {}
    try { rmSync(join(testDir, 'jizhang.db-wal'), { force: true }) } catch {}
    try { rmSync(join(testDir, 'jizhang.db-shm'), { force: true }) } catch {}
    initDatabase()
  })

  // -------- 人员 CRUD --------
  describe('People CRUD', () => {
    it('初始化后应该有 4 个预置人员', () => {
      const people = getPeople()
      expect(people.length).toBe(4)
      const names = people.map(p => p.name)
      expect(names).toContain('廖泽平')
      expect(names).toContain('黄柏清')
      expect(names).toContain('张先澍')
      expect(names).toContain('刘承洲')
    })

    it('addPerson 应该增加新人员', () => {
      const p = addPerson('测试人员')
      expect(p.name).toBe('测试人员')
      expect(p.id).toBeGreaterThan(0)
    })

    it('updatePerson 应该更新人员名称', () => {
      const people = getPeople()
      const first = people[0]
      const updated = updatePerson(first.id, '新名字')
      expect(updated).toBeDefined()
      expect(updated!.name).toBe('新名字')
    })

    it('deletePerson 应该删除人员并返回 true', () => {
      const p = addPerson('待删除')
      expect(deletePerson(p.id)).toBe(true)
      const people = getPeople()
      expect(people.find(pp => pp.id === p.id)).toBeUndefined()
    })
  })

  // -------- 花销 CRUD --------
  describe('Expenses CRUD', () => {
    it('addExpense 应该增加花销并自动生成欠款记录', () => {
      const expense: NewExpense = {
        currency: 'CNY',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-01',
        note: '聚餐',
        items: [
          { personId: 1, amount: 2500, note: '' },
          { personId: 2, amount: 2500, note: '' }
        ]
      }
      const result = addExpense(expense)
      expect(result.id).toBeGreaterThan(0)
      expect(result.totalAmount).toBe(5000)
      expect(result.currency).toBe('CNY')
      expect(result.items.length).toBe(2)
    })

    it('getExpenses 应该返回分页结果', () => {
      const expense: NewExpense = {
        currency: 'AUD',
        category1: 'transport',
        category2: 'taxi',
        date: '2026-07-02',
        note: '打车',
        items: [
          { personId: 1, amount: 1375, note: '' }
        ]
      }
      addExpense(expense)

      const result = getExpenses({ limit: 10, offset: 0 })
      expect(result.total).toBeGreaterThanOrEqual(1)
      expect(result.expenses.length).toBeGreaterThanOrEqual(1)
    })

    it('getExpenses 应该支持按币种筛选', () => {
      // 添加一笔 AUD 和一笔 CNY
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-03',
        note: '',
        items: [{ personId: 1, amount: 1000, note: '' }]
      })
      addExpense({
        currency: 'CNY',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-04',
        note: '',
        items: [{ personId: 2, amount: 2000, note: '' }]
      })

      const audExpenses = getExpenses({ currency: 'AUD' })
      expect(audExpenses.expenses.every(e => e.currency === 'AUD')).toBe(true)
      const cnyExpenses = getExpenses({ currency: 'CNY' })
      expect(cnyExpenses.expenses.every(e => e.currency === 'CNY')).toBe(true)
    })

    it('getExpenses 应该支持按人员筛选', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-05',
        note: '',
        items: [{ personId: 1, amount: 3000, note: '' }]
      })

      const result = getExpenses({ personId: 1 })
      expect(result.total).toBeGreaterThanOrEqual(1)
      for (const exp of result.expenses) {
        expect(exp.items.some(i => i.personId === 1)).toBe(true)
      }
    })

    it('deleteExpense 应该删除花销及相关欠款记录', () => {
      const exp = addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-06',
        note: '',
        items: [{ personId: 1, amount: 5000, note: '' }]
      })
      expect(deleteExpense(exp.id)).toBe(true)
      // 删除后应无法查到
      const result = getExpenses({ limit: 1000 })
      expect(result.expenses.find(e => e.id === exp.id)).toBeUndefined()
    })

    it('deleteAllExpenses 应该清空所有花销', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-07',
        note: '',
        items: [{ personId: 1, amount: 1000, note: '' }]
      })
      addExpense({
        currency: 'CNY',
        category1: 'transport',
        category2: 'taxi',
        date: '2026-07-08',
        note: '',
        items: [{ personId: 2, amount: 2000, note: '' }]
      })
      const count = deleteAllExpenses()
      expect(count).toBe(2)
      expect(getExpenses({ limit: 1000 }).total).toBe(0)
    })
  })

  // -------- 统计 --------
  describe('Statistics', () => {
    it('getCategoryStats 应该返回分类统计', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-10',
        note: '',
        items: [{ personId: 1, amount: 1000, note: '' }]
      })
      addExpense({
        currency: 'AUD',
        category1: 'transport',
        category2: 'taxi',
        date: '2026-07-11',
        note: '',
        items: [{ personId: 2, amount: 2000, note: '' }]
      })
      const stats = getCategoryStats({ currency: 'AUD' })
      // 至少应该有两条记录
      expect(stats.length).toBeGreaterThanOrEqual(2)
      const foodStat = stats.find(s => s.category1 === 'food')
      expect(foodStat).toBeDefined()
      expect(foodStat!.totalAmount).toBe(1000)
    })

    it('getMonthlyStats 应该返回月度统计', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-01',
        note: '',
        items: [{ personId: 1, amount: 3000, note: '' }]
      })
      const stats = getMonthlyStats()
      expect(stats.length).toBeGreaterThanOrEqual(1)
      expect(stats[0].totalAmount).toBe(3000)
    })

    it('getPersonStats 应该返回人员统计', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-01',
        note: '',
        items: [
          { personId: 1, amount: 1500, note: '' },
          { personId: 2, amount: 1500, note: '' }
        ]
      })
      const stats = getPersonStats()
      expect(stats.length).toBeGreaterThanOrEqual(2)
      const person1 = stats.find(s => s.personId === 1)
      expect(person1).toBeDefined()
      expect(person1!.totalAmount).toBe(1500)
    })
  })

  // -------- 汇率 --------
  describe('Exchange Rates', () => {
    it('初始化后应该有 AUD->CNY 汇率', () => {
      const rate = getLatestRate('AUD', 'CNY')
      expect(rate).toBeDefined()
      expect(rate!.rate).toBe(4.8)
      expect(rate!.fromCurrency).toBe('AUD')
      expect(rate!.toCurrency).toBe('CNY')
    })

    it('setExchangeRate 应该插入新汇率', () => {
      const newRate = setExchangeRate('AUD', 'CNY', 5.0)
      expect(newRate.rate).toBe(5.0)
      // 验证是最新
      const latest = getLatestRate('AUD', 'CNY')
      expect(latest!.rate).toBe(5.0)
    })
  })

  // -------- 欠款/结余 --------
  describe('Balances', () => {
    it('新增花销后应自动更新欠款', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-15',
        note: '',
        items: [{ personId: 1, amount: 5000, note: '' }]
      })
      const balance = getPersonBalance(1, 'AUD')
      expect(balance).toBe(5000)
    })

    it('addManualBalance 应该手动增加欠款', () => {
      addManualBalance(1, 'AUD', 10000, '借款')
      const balance = getPersonBalance(1, 'AUD')
      expect(balance).toBe(10000)
    })

    it('getAllBalances 应该返回所有人欠款', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-15',
        note: '',
        items: [{ personId: 1, amount: 3000, note: '' }]
      })
      const balances = getAllBalances('AUD')
      expect(balances.length).toBe(4)
      const p1 = balances.find(b => b.personId === 1)
      expect(p1).toBeDefined()
      expect(p1!.balance).toBe(3000)
    })

    it('settlePerson 应该清账', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-15',
        note: '',
        items: [{ personId: 1, amount: 5000, note: '' }]
      })
      const amount = settlePerson(1, 'AUD')
      expect(amount).toBe(-5000)
      expect(getPersonBalance(1, 'AUD')).toBe(0)
    })

    it('getBalanceHistory 应该返回历史记录', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-15',
        note: '',
        items: [{ personId: 1, amount: 3000, note: '' }]
      })
      const history = getBalanceHistory({ personId: 1 })
      expect(history.length).toBeGreaterThanOrEqual(1)
      expect(history[0].person_id).toBe(1)
      expect(history[0].type).toBe('expense')
    })

    it('deleteBalanceRecord 应该删除欠款记录', () => {
      addExpense({
        currency: 'AUD',
        category1: 'food',
        category2: 'gathering',
        date: '2026-07-15',
        note: '',
        items: [{ personId: 1, amount: 3000, note: '' }]
      })
      const history = getBalanceHistory({ personId: 1 })
      const result = deleteBalanceRecord(history[0].id)
      expect(result).toBe(true)
      expect(getPersonBalance(1, 'AUD')).toBe(0)
    })
  })

  // -------- 设置 --------
  describe('Settings', () => {
    it('setSetting 和 getSetting 应该正常工作', () => {
      setSetting('api_key', 'test-key-123')
      expect(getSetting('api_key')).toBe('test-key-123')
    })

    it('不存在的 key 应返回 undefined', () => {
      expect(getSetting('nonexistent')).toBeUndefined()
    })

    it('setSetting 应该覆盖已有值', () => {
      setSetting('api_key', 'new-value')
      expect(getSetting('api_key')).toBe('new-value')
    })
  })

  // -------- 分类 CRUD --------
  describe('Category CRUD', () => {
    it('初始化后应该有 10 个大类', () => {
      const cats = getAllCategories()
      expect(cats.length).toBe(10)
      const food = cats.find(c => c.id === 'food')
      expect(food).toBeDefined()
      expect(food!.children.length).toBeGreaterThan(0)
    })

    it('addCategory 应该增加用户分类', () => {
      const result = addCategory('自制分类', '📦', null)
      expect(result.success).toBe(true)
      expect(result.category).toBeDefined()
      expect(result.category!.name).toBe('自制分类')
    })

    it('addCategory 应该增加子分类', () => {
      const result = addCategory('子分类', '', 'food')
      expect(result.success).toBe(true)
    })

    it('addCategory 到不存在的父分类应失败', () => {
      const result = addCategory('测试', '', 'nonexistent')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不存在')
    })

    it('updateCategory 不应该编辑系统分类', () => {
      const result = updateCategory('food', '改个名字')
      expect(result.success).toBe(false)
      expect(result.error).toContain('系统分类不可编辑')
    })

    it('updateCategory 应该编辑用户分类', () => {
      addCategory('可编辑', '📦', null)
      const result = updateCategory('user_', '已编辑') // 会匹配到 user_ 开头的吗？不会，需要准确 ID
      // 获取刚添加的分类
      const cats = getAllCategories()
      const userCat = cats.find(c => c.id.startsWith('user_'))
      if (userCat) {
        const updateResult = updateCategory(userCat.id, '已编辑')
        expect(updateResult.success).toBe(true)
      }
    })

    it('deleteCategory 不应该删除系统分类', () => {
      const result = deleteCategory('food')
      expect(result.success).toBe(false)
    })

    it('deleteCategory 应该删除用户分类', () => {
      addCategory('待删除', '📦', null)
      const cats = getAllCategories()
      const userCat = cats.find(c => c.id.startsWith('user_'))
      if (userCat) {
        const result = deleteCategory(userCat.id)
        expect(result.success).toBe(true)
      }
    })

    it('getCategoryInfo 应该返回分类信息', () => {
      const info = getCategoryInfo('food', 'gathering')
      expect(info).not.toBeNull()
      expect(info!.category1Name).toBe('餐饮美食')
    })
  })
})
