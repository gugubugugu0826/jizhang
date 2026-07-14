// ============================================================
// ai-parser.ts — AI 解析器 单元测试
// ============================================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟 https 模块
let mockResponseData: string = ''
let mockStatusCode: number = 200
let mockError: Error | null = null

vi.mock('https', () => {
  const EventEmitter = require('events')
  class MockRequest extends EventEmitter {
    constructor(
      private options: any,
      private callback: (res: any) => void
    ) {
      super()
      // 异步模拟响应
      process.nextTick(() => {
        if (mockError) {
          this.emit('error', mockError)
          return
        }
        const res = new EventEmitter()
        res.statusCode = mockStatusCode
        this.callback(res)
        process.nextTick(() => {
          res.emit('data', Buffer.from(mockResponseData))
          res.emit('end')
        })
      })
    }
    write() {}
    end() {}
    destroy(err?: Error) {
      if (err) this.emit('error', err)
    }
  }
  return {
    default: {
      request: (options: any, callback: (res: any) => void) =>
        new MockRequest(options, callback)
    },
    request: (options: any, callback: (res: any) => void) =>
      new MockRequest(options, callback)
  }
})

// 现在导入被测试模块
import { callAI } from '../../src/main/ai-parser'

const testPeople = [
  { id: 1, name: '廖泽平' },
  { id: 2, name: '黄柏清' },
  { id: 3, name: '张先澍' },
  { id: 4, name: '刘承洲' }
]

const testOpts = {
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  model: 'deepseek-chat',
  apiKey: 'sk-test-key-1234567890',
  providerId: 'deepseek'
}

describe('callAI', () => {
  beforeEach(() => {
    mockResponseData = ''
    mockStatusCode = 200
    mockError = null
  })

  it('API Key 未配置时应返回错误', async () => {
    const result = await callAI('打车13.75刀', testPeople, {
      ...testOpts,
      apiKey: ''
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('API Key')
  })

  it('API Key 太短时应返回错误', async () => {
    const result = await callAI('打车13.75刀', testPeople, {
      ...testOpts,
      apiKey: 'short'
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('API Key')
  })

  it('端点为空的应返回错误', async () => {
    const result = await callAI('打车13.75刀', testPeople, {
      ...testOpts,
      endpoint: ''
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('接口地址')
  })

  it('模型为空时应该返回错误', async () => {
    const result = await callAI('打车13.75刀', testPeople, {
      ...testOpts,
      model: ''
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('模型')
  })

  it('200 响应应该解析成功', async () => {
    mockResponseData = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                currency: 'AUD',
                category1: 'transport',
                category2: 'taxi',
                date: '2026-07-14',
                note: '打车',
                items: [{ personName: '廖泽平', amount: 13.75, note: '' }]
              }
            ])
          }
        }
      ]
    })
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(true)
    expect(result.expenses.length).toBe(1)
    expect(result.expenses[0].currency).toBe('AUD')
    expect(result.expenses[0].category1).toBe('transport')
  })

  it('401 响应应该返回认证失败错误', async () => {
    mockStatusCode = 401
    mockResponseData = 'Unauthorized'
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(false)
    expect(result.error).toContain('认证失败')
  })

  it('403 响应应该返回认证失败错误', async () => {
    mockStatusCode = 403
    mockResponseData = 'Forbidden'
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(false)
    expect(result.error).toContain('认证失败')
  })

  it('500 响应应该返回错误信息', async () => {
    mockStatusCode = 500
    mockResponseData = 'Internal Server Error'
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(false)
    expect(result.error).toContain('500')
  })

  it('空内容应该返回错误', async () => {
    mockResponseData = JSON.stringify({
      choices: [{ message: { content: '' } }]
    })
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(false)
    expect(result.error).toContain('空内容')
  })

  it('markdown 代码块中的 JSON 应该能正确提取', async () => {
    mockResponseData = JSON.stringify({
      choices: [
        {
          message: {
            content: '```json\n[\n  {"currency":"AUD","category1":"food","category2":"gathering","date":"2026-07-14","note":"聚餐","items":[{"personName":"廖泽平","amount":25,"note":""}]}\n]\n```'
          }
        }
      ]
    })
    const result = await callAI('廖泽平25刀聚餐', testPeople, testOpts)
    expect(result.success).toBe(true)
    expect(result.expenses.length).toBe(1)
    expect(result.expenses[0].currency).toBe('AUD')
  })

  it('网络错误应该被捕获', async () => {
    mockError = new Error('connect ECONNREFUSED')
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(false)
    expect(result.error).toContain('请求失败')
  })

  it('非 JSON 格式的 AI 响应应该返回错误', async () => {
    mockResponseData = JSON.stringify({
      choices: [{ message: { content: '这不是一个JSON' } }]
    })
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(false)
    // JSON 解析会失败
    expect(result.error).toBeDefined()
  })

  it('返回非数组的 JSON 应该返回格式错误', async () => {
    mockResponseData = JSON.stringify({
      choices: [{ message: { content: '{"not":"an array"}' } }]
    })
    const result = await callAI('打车13.75刀', testPeople, testOpts)
    expect(result.success).toBe(false)
    expect(result.error).toContain('格式不正确')
  })
})
