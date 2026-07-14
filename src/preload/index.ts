// ============================================================
// 记账APP v2 — 预加载脚本
// ============================================================
import { contextBridge, ipcRenderer } from 'electron'
import type { Category, Expense, NewExpense, Person, Currency, ExchangeRate } from '../shared/types'

const api = {
  // 分类
  getCategories: (): Promise<Category[]> => ipcRenderer.invoke('categories:getAll'),
  addCategory: (name: string, icon: string, parentId: string | null):
    Promise<{ success: boolean; category?: any; error?: string }> =>
    ipcRenderer.invoke('categories:add', name, icon, parentId),
  updateCategory: (id: string, name: string, icon?: string):
    Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('categories:update', id, name, icon),
  deleteCategory: (id: string):
    Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('categories:delete', id),

  // 人员
  getPeople: (): Promise<Person[]> => ipcRenderer.invoke('people:getAll'),
  addPerson: (name: string): Promise<Person> => ipcRenderer.invoke('people:add', name),
  updatePerson: (id: number, name: string): Promise<Person | undefined> => ipcRenderer.invoke('people:update', id, name),
  deletePerson: (id: number): Promise<boolean> => ipcRenderer.invoke('people:delete', id),

  // 花销
  addExpense: (expense: NewExpense): Promise<Expense> => ipcRenderer.invoke('expenses:add', expense),
  addExpenses: (expenses: NewExpense[]): Promise<Expense[]> => ipcRenderer.invoke('expenses:addBatch', expenses),

  getExpenses: (params?: {
    currency?: Currency; personId?: number; category1?: string
    startDate?: string; endDate?: string; limit?: number; offset?: number
  }): Promise<{ expenses: Expense[]; total: number }> =>
    ipcRenderer.invoke('expenses:getAll', params),

  getExpenseById: (id: number): Promise<Expense | undefined> =>
    ipcRenderer.invoke('expenses:getById', id),

  updateExpense: (id: number, updates: any): Promise<Expense | undefined> =>
    ipcRenderer.invoke('expenses:update', id, updates),

  deleteExpense: (id: number): Promise<boolean> => ipcRenderer.invoke('expenses:delete', id),
  deleteExpenses: (ids: number[]): Promise<number> => ipcRenderer.invoke('expenses:deleteBatch', ids),
  deleteAllExpenses: (): Promise<number> => ipcRenderer.invoke('expenses:deleteAll'),

  // 统计
  getCategoryStats: (params?: { currency?: Currency; startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke('stats:byCategory', params),

  getMonthlyStats: (params?: { currency?: Currency; startMonth?: string; endMonth?: string }) =>
    ipcRenderer.invoke('stats:byMonth', params),

  getPersonStats: (params?: { currency?: Currency; startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke('stats:byPerson', params),

  getCategoryInfo: (category1: string, category2: string) =>
    ipcRenderer.invoke('category:getInfo', category1, category2),

  // 汇率
  getExchangeRate: (from: Currency, to: Currency): Promise<ExchangeRate | undefined> =>
    ipcRenderer.invoke('exchangeRate:get', from, to),

  setExchangeRate: (from: Currency, to: Currency, rate: number): Promise<ExchangeRate> =>
    ipcRenderer.invoke('exchangeRate:set', from, to, rate),

  // AI 解析
  aiParse: (text: string, people: { id: number; name: string }[], opts: {
    endpoint: string; model: string; apiKey: string; providerId: string; categories?: Category[]
  }): Promise<any> =>
    ipcRenderer.invoke('ai:parse', text, people, opts),

  // 设置
  getSetting: (key: string): Promise<string | undefined> =>
    ipcRenderer.invoke('settings:get', key),
  // 欠款/结余
  getBalances: (currency: Currency): Promise<{ personId: number; personName: string; balance: number }[]> =>
    ipcRenderer.invoke('balance:getAll', currency),
  addManualBalance: (personId: number, currency: Currency, amount: number, note: string): Promise<void> =>
    ipcRenderer.invoke('balance:addManual', personId, currency, amount, note),
  settlePerson: (personId: number, currency: Currency): Promise<number> =>
    ipcRenderer.invoke('balance:settle', personId, currency),
  getBalanceHistory: (params?: any): Promise<any[]> =>
    ipcRenderer.invoke('balance:history', params),
  deleteBalanceRecord: (id: number): Promise<boolean> =>
    ipcRenderer.invoke('balance:delete', id)
}

if (process.contextIsolated) {
  try { contextBridge.exposeInMainWorld('api', api) } catch (error) { console.error(error) }
} else {
  // @ts-ignore
  window.api = api
}

export type AppApi = typeof api
