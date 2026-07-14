// ============================================================
// AI 解析器（主进程，支持多提供商）
// ============================================================
import https from 'https'

export interface AiParseOptions {
  endpoint: string
  model: string
  apiKey: string
  providerId: string
}

export interface AiParseResult {
  success: boolean
  expenses: {
    currency: 'CNY' | 'AUD'
    category1: string
    category2: string
    date: string
    note: string
    items: { personName: string; amount: number; note: string }[]
  }[]
  error?: string
  rawResponse?: string
}

const SYSTEM_PROMPT = `你是一个记账解析助手。解析用户用自然语言描述的消费记录，返回 JSON 数组。

规则：
1. 币种：出现"刀"或"$"为AUD，出现"人民币"/"元"/"块"为CNY
2. 提取所有数字金额，保留两位小数
3. 人员识别：廖泽平、黄柏清、张先澍、刘承洲（打字变体：黄百清/黄百星=黄柏清，张先树=张先澍，刘成洲/刘程周/卢成周=刘承洲）
4. 分摊：出现"平分"/"AA"/"均分"/"大家"/"四个人"/"一起平分" → 金额平分给相关人员
5. "XXX是YY刀加ZZ刀" = 一个人多笔金额，加总
6. "XXX和YYY ZZ刀" = 两人平分
7. 分类：打车→transport/taxi，麦当劳/汉堡王/披萨/炸串/拉面/麻辣烫/烧烤/海底捞/喜茶/聚餐/UberEat/暗宝/猪脚/烧鸭/肠粉→food/gathering，中超/超市→shopping/daily，网络→housing/utilities，收卡/买酒→other/misc
8. 日期从"X月X号"提取，默认当前日期

只返回 JSON 数组：[
  {"currency":"AUD","category1":"food","category2":"gathering","date":"2026-06-15","note":"简述","items":[{"personName":"姓名","amount":15.50,"note":""}]}
]`

function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers, timeout: 60000
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode || 0, data }))
    })
    req.on('error', err => reject(err))
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时（60秒）')) })
    req.write(body)
    req.end()
  })
}

export async function callAI(
  text: string,
  people: { id: number; name: string }[],
  opts: AiParseOptions
): Promise<AiParseResult> {
  if (!opts.apiKey || opts.apiKey.length < 10) {
    return { success: false, expenses: [], error: 'API Key 未配置或无效' }
  }
  if (!opts.endpoint || !opts.model) {
    return { success: false, expenses: [], error: '接口地址或模型未配置' }
  }

  const peopleList = people.map(p => p.name).join('、')
  const userPrompt = `已知人员：${peopleList}\n当前日期：${new Date().toISOString().slice(0, 10)}\n\n解析以下记账文字：\n\n${text}`

  try {
    // 构建请求体（兼容 OpenAI 格式，DeepSeek 也兼容）
    const body = JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4096,
      temperature: 0.1
    })

    const { status, data } = await httpsPost(opts.endpoint, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`
    }, body)

    if (status === 401 || status === 403) {
      return { success: false, expenses: [], error: `认证失败 (${status})，请检查 API Key 是否正确` }
    }
    if (status !== 200) {
      const preview = data.substring(0, 300).replace(/\n/g, ' ')
      return { success: false, expenses: [], error: `API 返回错误 ${status}：${preview}` }
    }

    const json = JSON.parse(data)
    const content = json.choices?.[0]?.message?.content || ''
    if (!content.trim()) return { success: false, expenses: [], error: 'AI 返回了空内容，请重试' }

    // 解析 JSON
    let jsonStr = content.trim()
    const cb = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (cb) jsonStr = cb[1].trim()
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (arrMatch) jsonStr = arrMatch[0]

    const expenses = JSON.parse(jsonStr)
    if (!Array.isArray(expenses)) return { success: false, expenses: [], error: 'AI 返回格式不正确' }

    return { success: true, expenses, rawResponse: content }
  } catch (err: any) {
    return { success: false, expenses: [], error: `请求失败: ${err.message || err}` }
  }
}
