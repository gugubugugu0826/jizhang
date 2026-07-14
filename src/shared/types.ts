// ============================================================
// 记账APP v2 — 数据模型类型定义
// ============================================================

/** 币种 */
export type Currency = 'CNY' | 'AUD'

/** 人员 */
export interface Person {
  id: number
  name: string
  createdAt: string
}

/** 花销分摊明细 */
export interface ExpenseItem {
  id: number
  expenseId: number
  personId: number
  personName?: string // JOIN 填充
  amount: number // 单位：分
  note: string
}

/** 新建分摊明细 */
export interface NewExpenseItem {
  personId: number
  amount: number // 单位：分
  note: string
}

/** 花销总记录 */
export interface Expense {
  id: number
  currency: Currency
  totalAmount: number // 单位：分，等于 items 金额之和
  category1: string
  category2: string
  date: string // YYYY-MM-DD
  note: string
  createdAt: string
  items: ExpenseItem[]
}

/** 新建花销记录 */
export interface NewExpense {
  currency: Currency
  category1: string
  category2: string
  date: string
  note: string
  items: NewExpenseItem[]
}

/** 汇率记录 */
export interface ExchangeRate {
  id: number
  fromCurrency: Currency
  toCurrency: Currency
  rate: number
  createdAt: string
}

// ---- 分类相关（保持不变）----

export interface SubCategory {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  icon: string
  children: SubCategory[]
}

// ---- 统计相关 ----

export interface CategoryStat {
  categoryName: string
  categoryIcon: string
  totalAmount: number
  percentage: number
  count: number
}

export interface MonthlyStat {
  month: string
  totalAmount: number
  count: number
}

export interface PersonStat {
  personId: number
  personName: string
  totalAmount: number
  percentage: number
  count: number
}
