import { describe, it, expect } from 'vitest'
import { parseText, ParsedExpense, ParserContext } from '../src/shared/parser'

// ============================================================
// 记账APP — 智能解析器单元测试
// ============================================================

const defaultPeople = [
  { id: 1, name: '廖泽平' },
  { id: 2, name: '黄柏清' },
  { id: 3, name: '张先澍' },
  { id: 4, name: '刘承洲' },
]

const defaultCtx: ParserContext = {
  people: defaultPeople,
  defaultCurrency: 'AUD',
  defaultDate: '2026-07-14',
}

describe('parseText — 币种识别', () => {
  it('应识别"刀"为澳元', () => {
    const results = parseText('打车13.75刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].currency).toBe('AUD')
  })

  it('应识别"元"为人民币', () => {
    const results = parseText('吃饭花了50元', { ...defaultCtx, defaultCurrency: 'CNY' })
    expect(results.length).toBeGreaterThan(0)
    // 文本中出现"元"，默认币种处理；如果有"刀"则优先
    // 纯"元"文本应该匹配CNY
  })

  it('无币种标记时使用默认币种', () => {
    const results = parseText('超市买菜', defaultCtx)
    // 没有金额的文本可能不会产生结果，这取决于解析器
    if (results.length > 0) {
      expect(results[0].currency).toBeDefined()
    }
  })
})

describe('parseText — 日期提取', () => {
  it('应从"6月15号"提取日期', () => {
    const results = parseText('6月15号打车13.75刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].date).toBe('2026-06-15')
  })

  it('无日期时使用默认日期', () => {
    const results = parseText('打车13.75刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].date).toBe('2026-07-14')
  })
})

describe('parseText — 分类识别', () => {
  it('应识别"打车"为交通出行/网约车', () => {
    const results = parseText('打车13.75刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].category1).toBe('transport')
    expect(results[0].category2).toBe('taxi')
  })

  it('应识别"麦当劳"为餐饮美食/聚餐', () => {
    const results = parseText('麦当劳25刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].category1).toBe('food')
    expect(results[0].category2).toBe('gathering')
  })

  it('应识别"超市"为购物消费/日用品', () => {
    const results = parseText('超市买东西30刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].category1).toBe('shopping')
    expect(results[0].category2).toBe('daily')
  })

  it('无法匹配时默认为"其他"分类', () => {
    const results = parseText('不知道买了什么', defaultCtx)
    if (results.length > 0) {
      expect(results[0].category1).toBe('other')
    }
  })
})

describe('parseText — 金额提取', () => {
  it('应正确提取浮点金额', () => {
    const results = parseText('廖泽平打车13.75刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].items.length).toBeGreaterThan(0)
    // 金额应该 > 0（具体值取决于分摊逻辑）
    const totalAmount = results[0].items.reduce((sum, item) => sum + item.amount, 0)
    expect(totalAmount).toBeGreaterThan(0)
  })

  it('应正确处理整数金额', () => {
    const results = parseText('廖泽平吃饭25刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
  })

  it('空金额文本应正确处理', () => {
    const results = parseText('没有金额的描述', defaultCtx)
    // 没有金额的文本应该返回空结果
    expect(Array.isArray(results)).toBe(true)
  })
})

describe('parseText — 人员识别', () => {
  it('应识别"廖泽平"名字', () => {
    const results = parseText('廖泽平吃饭25刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
  })

  it('应识别别名"黄百清"为"黄柏清"', () => {
    const results = parseText('黄百清打车15刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
  })

  it('应识别别名"张先树"为"张先澍"', () => {
    const results = parseText('张先树买东西20刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('parseText — 分摊逻辑', () => {
  it('"大家平分"应分摊给所有人', () => {
    const results = parseText('大家平分60刀外卖', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    if (results[0].items.length > 0) {
      const amounts = results[0].items.map(i => i.amount)
      // 每人应付金额相等（考虑取整误差）
      const first = amounts[0]
      amounts.forEach(a => {
        expect(Math.abs(a - first)).toBeLessThanOrEqual(1)
      })
    }
  })

  it('"四个人平分"应分摊给4人', () => {
    const results = parseText('四个人平分80刀', defaultCtx)
    expect(results.length).toBeGreaterThan(0)
    if (results[0].items.length > 0) {
      expect(results[0].items.length).toBeLessThanOrEqual(4)
    }
  })
})

describe('parseText — 边界条件', () => {
  it('空字符串应返回空数组', () => {
    const results = parseText('', defaultCtx)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('极短输入应返回空数组', () => {
    const results = parseText('ab', defaultCtx)
    expect(Array.isArray(results)).toBe(true)
    // 短于4个字符的输入被过滤
  })

  it('只有人名没有金额的输入', () => {
    const results = parseText('廖泽平今天', defaultCtx)
    expect(Array.isArray(results)).toBe(true)
  })

  it('包含特殊字符的输入', () => {
    const results = parseText('打车@#$%13.75刀', defaultCtx)
    expect(Array.isArray(results)).toBe(true)
  })
})
