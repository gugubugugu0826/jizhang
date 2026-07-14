// ============================================================
// categories.ts — 分类种子数据 + 查询函数 单元测试
// ============================================================
import { describe, it, expect } from 'vitest'
import {
  SYSTEM_CATEGORIES,
  getCategoryInfo,
  getCategory1Options,
  getCategory2Options
} from '../../src/shared/categories'

describe('SYSTEM_CATEGORIES', () => {
  it('应该有10个大类', () => {
    expect(SYSTEM_CATEGORIES.length).toBe(10)
  })

  it('每个大类都应该有 children', () => {
    for (const cat of SYSTEM_CATEGORIES) {
      expect(cat.children.length).toBeGreaterThan(0)
      expect(cat.isSystem).toBe(true)
    }
  })

  it('所有大类 ID 应该唯一', () => {
    const ids = SYSTEM_CATEGORIES.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个大类内子分类 ID 应该唯一', () => {
    for (const cat of SYSTEM_CATEGORIES) {
      const childIds = cat.children.map(c => c.id)
      expect(new Set(childIds).size).toBe(childIds.length)
    }
  })

  it('food 大类应该有 6 个子分类', () => {
    const food = SYSTEM_CATEGORIES.find(c => c.id === 'food')
    expect(food).toBeDefined()
    expect(food!.children.length).toBe(6)
    expect(food!.children.map(c => c.id)).toContain('gathering')
  })

  it('所有大类应该包含必备字段', () => {
    for (const cat of SYSTEM_CATEGORIES) {
      expect(cat.id).toBeTruthy()
      expect(cat.name).toBeTruthy()
      expect(cat.icon).toBeTruthy()
      for (const child of cat.children) {
        expect(child.id).toBeTruthy()
        expect(child.name).toBeTruthy()
      }
    }
  })
})

describe('getCategoryInfo', () => {
  it('应该根据一级和二级分类 ID 返回名称', () => {
    const info = getCategoryInfo('food', 'gathering')
    expect(info).not.toBeNull()
    expect(info!.category1Name).toBe('餐饮美食')
    expect(info!.category1Icon).toBe('🍽️')
    expect(info!.category2Name).toBe('聚餐')
  })

  it('一级分类不存在应返回 null', () => {
    expect(getCategoryInfo('nonexistent', 'misc')).toBeNull()
  })

  it('二级分类不存在应返回 null', () => {
    expect(getCategoryInfo('food', 'nonexistent')).toBeNull()
  })

  it('transport 下的 taxi 应该识别', () => {
    const info = getCategoryInfo('transport', 'taxi')
    expect(info).not.toBeNull()
    expect(info!.category1Name).toBe('交通出行')
    expect(info!.category2Name).toBe('网约车')
  })
})

describe('getCategory1Options', () => {
  it('应该返回 10 个大类选项', () => {
    const options = getCategory1Options()
    expect(options.length).toBe(10)
  })

  it('每个选项应该包含 value, label, icon', () => {
    const opts = getCategory1Options()
    for (const opt of opts) {
      expect(opt).toHaveProperty('value')
      expect(opt).toHaveProperty('label')
      expect(opt).toHaveProperty('icon')
    }
  })

  it('第一个大类应该是 food', () => {
    expect(getCategory1Options()[0].value).toBe('food')
  })
})

describe('getCategory2Options', () => {
  it('food 的二级分类应该包含早餐和聚餐', () => {
    const options = getCategory2Options('food')
    expect(options.some(o => o.value === 'breakfast')).toBe(true)
    expect(options.some(o => o.value === 'gathering')).toBe(true)
  })

  it('不存在的二级分类应返回空数组', () => {
    expect(getCategory2Options('nonexistent')).toEqual([])
  })

  it('transport 应该有 6 个子分类', () => {
    const options = getCategory2Options('transport')
    expect(options.length).toBe(6)
    expect(options.map(o => o.value)).toContain('taxi')
    expect(options.map(o => o.value)).toContain('transit')
  })
})
