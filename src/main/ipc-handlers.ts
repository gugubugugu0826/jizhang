// ============================================================
// 记账APP v2 — IPC 处理器
// ============================================================
import { ipcMain } from 'electron'
import * as db from './database'
import { callAI, AiParseOptions } from './ai-parser'
import type { Expense, NewExpense, Person, Currency, ExchangeRate } from '../shared/types'

export function registerIpcHandlers(): void {
  // ---- 分类 ----
  ipcMain.handle('categories:getAll', () => db.getAllCategories())

  ipcMain.handle('categories:add', (_e, name: string, icon: string, parentId: string | null) => {
    return db.addCategory(name, icon, parentId)
  })

  ipcMain.handle('categories:update', (_e, id: string, name: string, icon?: string) => {
    return db.updateCategory(id, name, icon)
  })

  ipcMain.handle('categories:delete', (_e, id: string) => {
    return db.deleteCategory(id)
  })

  // ---- 人员 ----
  ipcMain.handle('people:getAll', (): Person[] => db.getPeople())
  ipcMain.handle('people:add', (_e, name: string): Person => db.addPerson(name))
  ipcMain.handle('people:update', (_e, id: number, name: string): Person | undefined => db.updatePerson(id, name))
  ipcMain.handle('people:delete', (_e, id: number): boolean => db.deletePerson(id))

  // ---- 花销 ----
  ipcMain.handle('expenses:add', (_e, expense: NewExpense): Expense => db.addExpense(expense))
  ipcMain.handle('expenses:addBatch', (_e, expenses: NewExpense[]): Expense[] => db.addExpenses(expenses))

  ipcMain.handle('expenses:getAll', (_e, params?: {
    currency?: Currency; personId?: number; category1?: string
    startDate?: string; endDate?: string; limit?: number; offset?: number
  }) => db.getExpenses(params))

  ipcMain.handle('expenses:getById', (_e, id: number): Expense | undefined => db.getExpenseById(id))
  ipcMain.handle('expenses:update', (_e, id: number, updates: any): Expense | undefined => db.updateExpense(id, updates))
  ipcMain.handle('expenses:delete', (_e, id: number): boolean => db.deleteExpense(id))
  ipcMain.handle('expenses:deleteBatch', (_e, ids: number[]): number => db.deleteExpenses(ids))
  ipcMain.handle('expenses:deleteAll', (): number => db.deleteAllExpenses())

  // ---- 统计 ----
  ipcMain.handle('stats:byCategory', (_e, params?: { currency?: Currency; startDate?: string; endDate?: string }) => {
    const raw = db.getCategoryStats(params)
    return raw.map(s => {
      const cat = db.getCategoryById(s.category1)
      return { ...s, categoryName: cat?.name ?? s.category1, categoryIcon: cat?.icon ?? '📦' }
    })
  })

  ipcMain.handle('stats:byMonth', (_e, params?: { currency?: Currency; startMonth?: string; endMonth?: string }) => {
    return db.getMonthlyStats(params)
  })

  ipcMain.handle('stats:byPerson', (_e, params?: { currency?: Currency; startDate?: string; endDate?: string }) => {
    return db.getPersonStats(params)
  })

  // ---- 分类查询 ----
  ipcMain.handle('category:getInfo', (_e, category1: string, category2: string) => {
    return db.getCategoryInfo(category1, category2)
  })

  // ---- 汇率 ----
  ipcMain.handle('exchangeRate:get', (_e, from: Currency, to: Currency): ExchangeRate | undefined => {
    return db.getLatestRate(from, to)
  })

  ipcMain.handle('exchangeRate:set', (_e, from: Currency, to: Currency, rate: number): ExchangeRate => {
    return db.setExchangeRate(from, to, rate)
  })

  // ---- AI 解析 ----
  ipcMain.handle('ai:parse', async (_e, text: string, people: { id: number; name: string }[], opts: AiParseOptions) => {
    return callAI(text, people, opts)
  })

  // ---- 设置 ----
  ipcMain.handle('settings:get', (_e, key: string): string | undefined => {
    return db.getSetting(key)
  })
  ipcMain.handle('settings:set', (_e, key: string, value: string): void => {
    db.setSetting(key, value)
  })

  // ---- 欠款/结余 ----
  ipcMain.handle('balance:getAll', (_e, currency: Currency) => db.getAllBalances(currency))
  ipcMain.handle('balance:addManual', (_e, personId: number, currency: Currency, amount: number, note: string) => {
    db.addManualBalance(personId, currency, amount, note)
  })
  ipcMain.handle('balance:settle', (_e, personId: number, currency: Currency) => db.settlePerson(personId, currency))
  ipcMain.handle('balance:history', (_e, params?: any) => db.getBalanceHistory(params))
  ipcMain.handle('balance:delete', (_e, id: number) => db.deleteBalanceRecord(id))
}
