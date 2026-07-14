// ============================================================
// parser.ts — 本地正则解析器 单元测试
// ============================================================
import { describe, it, expect } from 'vitest'
import { parseText, toNewExpense, type ParserContext } from '../../src/shared/parser'

/** 测试用固定上下文：4 个人员 */
const defaultCtx: ParserContext = {
  people: [
    { id: 1, name: '廖泽平' },
    { id: 2, name: '黄柏清' },
    { id: 3, name: '张先澍' },
    { id: 4, name: '刘承洲' }
  ],
  defaultCurrency: 'AUD',
  defaultDate: '2026-07-14'
}

describe('parseText — 单人单笔模式', () => {
  it('应该解析 "张先澍肠粉16刀"', () => {
    const results = parseText('张先澍肠粉16刀', defaultCtx)
    expect(results.length).toBe(1)
    const r = results[0]
    expect(r.currency).toBe('AUD')
    expect(r.items.length).toBe(1)
    expect(r.items[0].personName).toBe('张先澍')
    expect(r.items[0].amount).toBe(1600) // 16 * 100
    expect(r.category1).toBe('food')
    expect(r.category2).toBe('gathering')
  })

  it('应该解析 "打车13.75刀"（无指定人）', () => {
    const results = parseText('打车13.75刀', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].currency).toBe('AUD')
    expect(results[0].items.length).toBe(0) // 无指定人
    expect(results[0].category1).toBe('transport')
    expect(results[0].category2).toBe('taxi')
  })

  it('应该解析 "6月15号打车13.75刀"（有日期）', () => {
    const results = parseText('6月15号打车13.75刀', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].date).toBe('2026-06-15')
    expect(results[0].category1).toBe('transport')
  })
})

describe('parseText — 单人指定模式', () => {
  it('应该解析 "黄柏清自己花了25刀"', () => {
    const results = parseText('黄柏清自己花了25刀', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].items.length).toBe(1)
    expect(results[0].items[0].personName).toBe('黄柏清')
    expect(results[0].items[0].amount).toBe(2500)
  })
})

describe('parseText — 多人分账模式', () => {
  it('应该解析 "廖泽平是23.95刀加8刀加5.92刀，黄柏清是14.35刀加7.63刀"', () => {
    const results = parseText(
      '廖泽平是23.95刀加8刀加5.92刀，黄柏清是14.35刀加7.63刀',
      defaultCtx
    )
    expect(results.length).toBe(1)
    const r = results[0]
    // 廖泽平：23.95 + 8 + 5.92 = 37.87 → 3787分
    // 黄柏清：14.35 + 7.63 = 21.98 → 2198分
    expect(r.items.length).toBe(2)
    const liao = r.items.find(i => i.personName === '廖泽平')
    const huang = r.items.find(i => i.personName === '黄柏清')
    expect(liao).toBeDefined()
    expect(huang).toBeDefined()
    expect(liao!.amount).toBe(3787)
    expect(huang!.amount).toBe(2198)
  })

  it('应该解析 "廖泽平和黄柏清平分30刀"', () => {
    const results = parseText('廖泽平和黄柏清平分30刀', defaultCtx)
    expect(results.length).toBe(1)
    const r = results[0]
    expect(r.items.length).toBe(2)
    // 30刀平分 = 15刀每人 → 1500分
    for (const item of r.items) {
      expect(item.amount).toBe(1500)
    }
  })

  it('应该解析 "4个人平分100刀"', () => {
    const results = parseText('4个人平分100刀', defaultCtx)
    expect(results.length).toBe(1)
    const r = results[0]
    expect(r.items.length).toBe(4)
    // 100刀 / 4 = 25刀每人 → 2500分
    for (const item of r.items) {
      expect(item.amount).toBe(2500)
    }
  })

  it('应该解析 "大家平分80刀"', () => {
    const results = parseText('大家平分80刀', defaultCtx)
    expect(results.length).toBe(1)
    const r = results[0]
    expect(r.items.length).toBe(4)
    for (const item of r.items) {
      expect(item.amount).toBe(2000)
    }
  })
})

describe('parseText — 币种检测', () => {
  it('人民币应检测为 CNY', () => {
    const results = parseText('廖泽平花了100元买菜', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].currency).toBe('CNY')
  })

  it('刀应检测为 AUD', () => {
    const results = parseText('打车13.75刀', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].currency).toBe('AUD')
  })

  it('块也应检测为 CNY', () => {
    const results = parseText('黄柏清买了50块水果', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].currency).toBe('CNY')
  })
})

describe('parseText — 分类检测', () => {
  it('应通过关键词检测分类', () => {
    const testCases = [
      { text: '打车去机场', c1: 'transport', c2: 'taxi' },
      { text: '麦当劳聚餐', c1: 'food', c2: 'gathering' },
      { text: '超市购物', c1: 'shopping', c2: 'daily' },
      { text: '网费', c1: 'housing', c2: 'utilities' },
      { text: '看电影', c1: 'entertainment', c2: 'movie' },
      { text: '买药', c1: 'health', c2: 'medical' },
      { text: '买书', c1: 'education', c2: 'course' },
      { text: '红包', c1: 'social', c2: 'gift' },
      { text: '保险', c1: 'finance', c2: 'insurance' }
    ]
    for (const tc of testCases) {
      const results = parseText(tc.text + '16刀', defaultCtx)
      expect(results.length).toBe(1)
      expect(results[0].category1).toBe(tc.c1)
      expect(results[0].category2).toBe(tc.c2)
    }
  })
})

describe('parseText — 别名映射', () => {
  it('别名 "黄柏青" 应该映射到 黄柏清', () => {
    const results = parseText('黄柏青16刀', defaultCtx)
    expect(results.length).toBe(1)
    const r = results[0]
    expect(r.items[0].personName).toBe('黄柏青') // preserved as-is in personName
    expect(r.items[0].personId).toBe(2) // maps to 黄柏清's id
  })

  it('别名 "张先树" 应该映射到 张先澍', () => {
    const results = parseText('张先树16刀', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].items[0].personId).toBe(3)
  })
})

describe('parseText — 多行/多笔', () => {
  it('应该解析多笔花销（日期变化触发新块）', () => {
    const results = parseText(
      '打车13.75刀，6月16号张先澍肠粉16刀',
      defaultCtx
    )
    expect(results.length).toBe(2)
    expect(results[0].category1).toBe('transport')
    expect(results[1].category1).toBe('food')
  })
})

describe('parseText — 空/无效输入', () => {
  it('空字符串应返回空数组', () => {
    expect(parseText('', defaultCtx)).toEqual([])
  })

  it('太短的文本应返回空数组', () => {
    expect(parseText('a', defaultCtx)).toEqual([])
  })

  it('纯空格应返回空数组', () => {
    expect(parseText('   ', defaultCtx)).toEqual([])
  })
})

describe('parseText — 单人单笔带人名和动词', () => {
  it('"廖泽平买了菜25刀" 解析为廖泽平支出', () => {
    const results = parseText('廖泽平买了菜25刀', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].items[0].personName).toBe('廖泽平')
    expect(results[0].items[0].amount).toBe(2500)
  })

  it('"黄柏清买水果50块" 解析为 CNY', () => {
    const results = parseText('黄柏清买水果50块', defaultCtx)
    expect(results.length).toBe(1)
    expect(results[0].currency).toBe('CNY')
    expect(results[0].items[0].personName).toBe('黄柏清')
  })
})

describe('toNewExpense', () => {
  it('应该正确转换为 NewExpense 格式', () => {
    const results = parseText('廖泽平是23.95刀加8刀，黄柏清是14.35刀', defaultCtx)
    expect(results.length).toBe(1)
    const ne = toNewExpense(results[0], defaultCtx.people)
    expect(ne).not.toBeNull()
    expect(ne!.currency).toBe('AUD')
    expect(ne!.items.length).toBe(2)
    for (const item of ne!.items) {
      expect(item.personId).toBeGreaterThan(0)
      expect(item.amount).toBeGreaterThan(0)
    }
  })

  it('items 为空时应返回 null', () => {
    const results = parseText('打车13.75刀', defaultCtx)
    expect(results.length).toBe(1)
    const ne = toNewExpense(results[0], defaultCtx.people)
    expect(ne).toBeNull()
  })

  it('未知人名应返回 personId=0 并被过滤', () => {
    const result = parseText('UnknownPerson16刀', {
      people: [],
      defaultCurrency: 'AUD',
      defaultDate: '2026-07-14'
    })
    expect(result.length).toBe(1)
    // 没有已知人名，所以 items 为空
    expect(result[0].items.length).toBe(0)
    const ne = toNewExpense(result[0], [])
    expect(ne).toBeNull()
  })
})
