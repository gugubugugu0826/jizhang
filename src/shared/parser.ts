// ============================================================
// 记账APP v2 — 智能解析器
// ============================================================
import type { Currency, NewExpense, NewExpenseItem } from './types'

export interface ParsedItem {
  personName: string
  personId?: number
  amount: number // 分
  note: string
}

export interface ParsedExpense {
  currency: Currency
  category1: string
  category2: string
  date: string
  note: string
  items: ParsedItem[]
  rawText: string
}

export interface ParserContext {
  people: { id: number; name: string }[]
  defaultCurrency?: Currency
  defaultDate?: string
  categories?: { id: string; name: string; children: { id: string; name: string }[] }[]
}

// ---- 辅助函数 ----
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDate(m: number, d: number): string {
  const y = new Date().getFullYear()
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

// 人名别名映射
function buildAliasMap(people: {id:number;name:string}[]): Map<string,{id:number;name:string}> {
  const m = new Map<string,{id:number;name:string}>()
  for (const p of people) m.set(p.name, p)
  const aliases: Record<string,string> = {
    '廖泽平':'廖泽平',
    '黄柏清':'黄柏清','黄柏青':'黄柏清','黄百清':'黄柏清','黄百星':'黄柏清','黄柏星':'黄柏清',
    '张先澍':'张先澍','张先树':'张先澍',
    '刘承洲':'刘承洲','刘成洲':'刘承洲','刘程周':'刘承洲','刘成周':'刘承洲','卢成周':'刘承洲','刘程洲':'刘承洲','刘承周':'刘承洲',
  }
  for (const [alias, canonical] of Object.entries(aliases)) {
    const p = people.find(x => x.name === canonical)
    if (p && !m.has(alias)) m.set(alias, p)
  }
  return m
}

// 分类检测
const CAT_HINTS: {re:RegExp;c1:string;c2:string}[] = [
  {re:/打车|网约车|Uber|滴滴|出行/g,c1:'transport',c2:'taxi'},
  {re:/麦当劳|汉堡王|披萨|炸串|拉面|麻辣烫|烧烤|猪脚|烧鸭|肠粉|外卖|聚餐|吃饭|点餐|海底捞|喜茶|早茶|UberEat|uber.*eat|暗宝|先雨鲜|卤牛筋/g,c1:'food',c2:'gathering'},
  {re:/中超|超市|购物/g,c1:'shopping',c2:'daily'},
  {re:/网络|网费|wifi|宽带/g,c1:'housing',c2:'utilities'},
  {re:/公交|地铁|巴士|火车|飞机|加油/g,c1:'transport',c2:'transit'},
  {re:/电影|演出|健身|游戏/g,c1:'entertainment',c2:'movie'},
  {re:/买药|医院|看病/g,c1:'health',c2:'medical'},
  {re:/学费|课程|考试|书/g,c1:'education',c2:'course'},
  {re:/红包|礼物|孝敬/g,c1:'social',c2:'gift'},
  {re:/保险|贷款|手续费/g,c1:'finance',c2:'insurance'},
  {re:/收卡|买酒/g,c1:'other',c2:'misc'},
]
function detectCat(t: string, categories?: ParserContext['categories']): {c1:string;c2:string} {
  // 先检查硬编码关键词（最常见的场景）
  for (const h of CAT_HINTS) { h.re.lastIndex = 0; if (h.re.test(t)) return { c1: h.c1, c2: h.c2 } }
  // 再检查用户自定义分类：如果文本中出现分类名，则匹配
  if (categories) {
    for (const main of categories) {
      for (const sub of main.children) {
        if (t.includes(sub.name)) return { c1: main.id, c2: sub.id }
      }
      if (t.includes(main.name)) return { c1: main.id, c2: main.children[0]?.id || 'misc' }
    }
  }
  return { c1: 'other', c2: 'misc' }
}

// ---- 主函数 ----
export function parseText(raw: string, ctx: ParserContext): ParsedExpense[] {
  const nameMap = buildAliasMap(ctx.people)
  const defDate = ctx.defaultDate || todayStr()
  const results: ParsedExpense[] = []
  let curDate = defDate

  // 按逗号、句号、分号、换行切分
  const parts = raw.split(/[。；\n\r;]+/).flatMap(p => p.split(/[，,](?![^{]*})/)).map(s=>s.trim()).filter(s=>s.length>3)

  // 先把 parts 合并成 expense blocks
  // 策略：遇到日期开头或"然后""还有"等开始新 block，否则归入当前 block
  let currentBlock = ''
  for (const part of parts) {
    const hasDate = /^\d{1,2}[月\.]/.test(part)
    const isNew = /^(然后|还有|再|后面|6月|5月|这个|那)/.test(part)
    if ((hasDate || isNew) && currentBlock && hasDate) {
      const r = parseBlock(currentBlock, curDate, nameMap, ctx)
      if (r) { results.push(r); if (r.date) curDate = r.date }
      currentBlock = part
    } else if (hasDate && !currentBlock) {
      currentBlock = part
    } else {
      currentBlock += (currentBlock ? '，' : '') + part
    }
  }
  if (currentBlock.trim()) {
    const r = parseBlock(currentBlock, curDate, nameMap, ctx)
    if (r) results.push(r)
  }

  // 检查是否有完全没有识别到的文本
  return results
}

function parseBlock(
  text: string,
  defDate: string,
  nameMap: Map<string,{id:number;name:string}>,
  ctx: ParserContext
): ParsedExpense | null {
  if (!text.trim() || text.trim().length < 4) return null

  let date = defDate
  const dm = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]?/)
  if (dm) date = fmtDate(parseInt(dm[1]), parseInt(dm[2]))

  // 判断币种：看文字中主要出现刀还是人民币/元
  const audCount = (text.match(/\d+\.?\d*\s*刀/g)||[]).length
  const cnyCount = (text.match(/\d+\.?\d*\s*(?:人民币|元|块)/g)||[]).length
  const currency: Currency = cnyCount > audCount ? 'CNY' : 'AUD'

  const {c1:cat1, c2:cat2} = detectCat(text, ctx.categories)

  // ---- 模式1: "廖泽平是XX刀加YY刀，黄柏清是ZZ刀" - 多个人的金额直接分配 ----
  const personAmts = extractPersonAmounts(text, nameMap)
  if (personAmts.length > 0) {
    const items: ParsedItem[] = personAmts.map(pa => ({
      personName: pa.name, personId: pa.id,
      amount: Math.round(pa.total * 100), note: pa.detail
    }))
    return { currency, category1:cat1, category2:cat2, date, note: text.substring(0,120), items, rawText: text }
  }

  // ---- 模式2: "XXX和YYY平分ZZ刀" ----
  const twoSplit = text.match(/([一-龥]{2,4})(?:和|、)([一-龥]{2,4})\s*(?:平分|平摊|AA|评分)/)
  if (twoSplit) {
    const amts = extractAmounts(text)
    if (amts.length > 0) {
      const total = amts.reduce((a,b)=>a+b,0)
      const per = Math.round(total*100/2)
      const p1 = nameMap.get(twoSplit[1]), p2 = nameMap.get(twoSplit[2])
      return { currency, category1:cat1, category2:cat2, date, note:text.substring(0,120), items:[
        {personName:twoSplit[1],personId:p1?.id,amount:per,note:''},
        {personName:twoSplit[2],personId:p2?.id,amount:per,note:''}
      ], rawText:text }
    }
  }

  // ---- 模式3: "四个人平分" / "大家平分" / "大家一起平分" ----
  const splitN = text.match(/(\d+)个?人?\s*(?:平分|平摊|AA|均分|评分)/)
  const splitAll = text.match(/(?:大家|所有人|全部|都)\s*(?:是)?\s*(?:平分|平摊|AA|均分|评分)/)
  if (splitN || splitAll) {
    const amts = extractAmounts(text)
    if (amts.length > 0) {
      const total = amts.reduce((a,b)=>a+b,0)
      let n = ctx.people.length
      if (splitN) n = Math.min(parseInt(splitN[1]), ctx.people.length)
      const per = Math.round(total*100/n)
      return { currency, category1:cat1, category2:cat2, date, note:text.substring(0,120), items:
        ctx.people.slice(0,n).map(p=>({personName:p.name,personId:p.id,amount:per,note:''})),
        rawText:text }
    }
  }

  // ---- 模式4: "总花费XX刀" 但没有指定分摊人 - 平分给所有人 ----
  const totalOnly = text.match(/总(?:计|共|花费|价).*?(\d+\.?\d*)\s*刀/)
  const hasPaidCny = text.match(/(?:付了|花了|给了)\s*(\d+\.?\d*)\s*(?:人民币|元|块)/)
  if (totalOnly || hasPaidCny) {
    const amts = extractAmounts(text)
    if (amts.length > 0) {
      const total = amts.reduce((a,b)=>a+b,0)
      const per = Math.round(total*100/ctx.people.length)
      return { currency, category1:cat1, category2:cat2, date, note:text.substring(0,120), items:
        ctx.people.map(p=>({personName:p.name,personId:p.id,amount:per,note:''})),
        rawText:text }
    }
  }

  // ---- 模式5: 单人单笔 "张先树肠粉16刀" / "6月15号打车13.75刀" ----
  const amts = extractAmounts(text)
  if (amts.length === 1) {
    // 尝试匹配人名
    const nm = text.match(/([一-龥]{2,4})(?:的|自己|花了|买|买了)/)
    const p = nm ? nameMap.get(nm[1]) : undefined
    if (p) {
      return { currency, category1:cat1, category2:cat2, date, note:text.substring(0,120), items:[
        {personName:p.name,personId:p.id,amount:Math.round(amts[0]*100),note:''}
      ], rawText:text }
    }
    // 没有明确人名，创建空 items（让用户手动分配）
    return { currency, category1:cat1, category2:cat2, date, note:text.substring(0,120), items:[], rawText:text }
  }

  if (amts.length > 1) {
    // 多个金额但没有明确的人，平分
    const total = amts.reduce((a,b)=>a+b,0)
    const per = Math.round(total*100/ctx.people.length)
    return { currency, category1:cat1, category2:cat2, date, note:text.substring(0,120), items:
      ctx.people.map(p=>({personName:p.name,personId:p.id,amount:per,note:''})),
      rawText:text }
  }

  return null
}

// ---- 提取金额 ----
function extractAmounts(text: string): number[] {
  const res: number[] = []
  const re = /(\d+\.?\d*)\s*(?:刀|元)/g
  let m: RegExpExecArray|null
  while((m=re.exec(text))!==null) res.push(parseFloat(m[1]))
  return res
}

// ---- 提取人名→金额映射 ----
function extractPersonAmounts(
  text: string,
  nameMap: Map<string,{id:number;name:string}>
): {name:string;id?:number;total:number;detail:string}[] {
  const result: {name:string;id?:number;total:number;detail:string}[] = []
  // 按逗号切分
  const segs = text.split(/[,，]/).map(s=>s.trim()).filter(s=>s)
  for (const seg of segs) {
    // 匹配 "人名 + 是/花了/花费 + XX刀加XX刀加XX刀"
    // 或 "人名和/、人名 + XX刀"
    // 或 "人名自己 + XX刀"
    const m = seg.match(/^([一-龥]{2,4}(?:和|、)[一-龥]{2,4}|[一-龥]{2,4})/)
    if (!m) continue
    const namePart = m[1]

    const amts: number[] = []
    const amtRe = /(\d+\.?\d*)\s*(?:刀|元)/g
    let am: RegExpExecArray|null
    while((am=amtRe.exec(seg))!==null) amts.push(parseFloat(am[1]))

    if (amts.length === 0) continue
    const total = amts.reduce((a,b)=>a+b,0)

    // 检查是否是两个人名（"XXX和YYY"）
    const twoNames = namePart.match(/^([一-龥]{2,4})(?:和|、)([一-龥]{2,4})$/)
    if (twoNames) {
      const per = total / 2
      const p1 = nameMap.get(twoNames[1]), p2 = nameMap.get(twoNames[2])
      result.push({name:twoNames[1],id:p1?.id,total:per,detail:`与${twoNames[2]}平分`})
      result.push({name:twoNames[2],id:p2?.id,total:per,detail:`与${twoNames[1]}平分`})
    } else {
      const p = nameMap.get(namePart)
      result.push({name:namePart,id:p?.id,total,detail:amts.length>1?amts.map(a=>a+'刀').join('+'):''})
    }
  }
  // 合并同名
  const merged: typeof result = []
  const seen = new Map<string,number>()
  for (const r of result) {
    if (seen.has(r.name)) merged[seen.get(r.name)!].total += r.total
    else { seen.set(r.name, merged.length); merged.push(r) }
  }
  return merged
}

// 转换用
export function toNewExpense(pe: ParsedExpense, people: {id:number;name:string}[]): NewExpense|null {
  const items: NewExpenseItem[] = pe.items.map(i=>({
    personId: i.personId || people.find(p=>p.name===i.personName)?.id || 0,
    amount: i.amount, note: i.note
  })).filter(i=>i.personId>0)
  if (items.length===0) return null
  return { currency:pe.currency, category1:pe.category1, category2:pe.category2,
    date:pe.date, note:pe.note, items }
}
