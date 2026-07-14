import { useState, useEffect } from 'react'
import { Input, Button, Tag, Space, message, Alert, Typography, Modal, Spin } from 'antd'
import { ThunderboltOutlined, RobotOutlined, CheckOutlined, LoadingOutlined, KeyOutlined } from '@ant-design/icons'
import type { Person, Currency, NewExpense, NewExpenseItem, Category } from '../../../shared/types'
import type { ParsedExpense } from '../../../shared/parser'
import { parseText } from '../../../shared/parser'

const { TextArea } = Input
const { Text } = Typography

// ============================================================
// AI 提供商
// ============================================================
const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', label: 'DeepSeek API Key', url: 'https://platform.deepseek.com/api_keys', cost: '¥1/百万tokens，每次约 ¥0.01' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', label: 'OpenAI API Key', url: 'https://platform.openai.com/api-keys', cost: '约 $0.15/百万tokens' },
  { id: 'custom', name: '自定义', endpoint: '', model: '', label: 'API Key', url: '', cost: '自行配置' },
]

// ============================================================
// 解析结果弹窗（独立 Modal，滚动由 Modal 自身处理）
// ============================================================
function ResultModal({
  open, results: _results, people, categories, onClose, onSubmit
}: {
  open: boolean
  results: ParsedExpense[]
  people: Person[]
  categories: Category[]
  onClose: () => void
  onSubmit: (list: ParsedExpense[]) => void
}) {
  const [list, setList] = useState<EditableExpense[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setList(_results.map((r, i) => ({ ...r, key: `R-${i}`, confirmed: false })))
      setSelectAll(false)
    }
  }, [open, _results])

  const toggleAll = () => {
    const nv = !selectAll; setSelectAll(nv)
    setList(prev => prev.map(r => ({ ...r, confirmed: nv })))
  }
  const toggleOne = (key: string) => {
    setList(prev => {
      const next = prev.map(r => r.key === key ? { ...r, confirmed: !r.confirmed } : r)
      setSelectAll(next.length > 0 && next.every(r => r.confirmed))
      return next
    })
  }
  const upd = (key: string, field: string, value: any) => {
    setList(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r))
  }
  const updItem = (key: string, idx: number, field: string, value: any) => {
    setList(prev => prev.map(r => {
      if (r.key !== key) return r
      const items = [...r.items]; items[idx] = { ...items[idx], [field]: value }; return { ...r, items }
    }))
  }
  const addItem = (key: string) => {
    setList(prev => prev.map(r => r.key === key
      ? { ...r, items: [...r.items, { personName: '', personId: undefined, amount: 0, note: '' }] }
      : r))
  }

  const handleSubmit = async () => {
    const ok = list.filter(r => r.confirmed && r.items.length > 0)
    if (ok.length === 0) { message.warning('选中的记录都没有分摊人'); return }
    setSubmitting(true)
    try {
      const expenses: NewExpense[] = []
      for (const r of ok) {
        const items: NewExpenseItem[] = r.items.map(item => ({
          personId: item.personId || people.find(p => p.name === item.personName)?.id || 0,
          amount: item.amount, note: item.note
        })).filter(it => it.personId > 0)
        if (items.length === 0) continue
        expenses.push({ currency: r.currency, category1: r.category1, category2: r.category2, date: r.date, note: r.note, items })
      }
      if (expenses.length === 0) { message.warning('无有效记录'); return }
      await window.api.addExpenses(expenses)
      message.success(`✅ 成功入库 ${expenses.length} 条！`)
      onClose()
    } catch (err: any) { message.error(`入库失败：${err.message}`) }
    finally { setSubmitting(false) }
  }

  const confirmed = list.filter(r => r.confirmed).length
  const ready = list.filter(r => r.confirmed && r.items.length > 0).length

  const peopleOptions = people.map(p => ({ value: p.name, label: p.name }))

  return (
    <Modal
      title={<Space>📋 解析结果 <Tag>{list.length}条</Tag> <Tag color="green">已选{confirmed}</Tag> <Tag color="blue">可入库{ready}</Tag></Space>}
      open={open}
      onCancel={onClose}
      width={900}
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Button onClick={toggleAll}>{selectAll ? '取消全选' : '全选所有'}</Button>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <Button type="primary" icon={<CheckOutlined />} onClick={handleSubmit} loading={submitting} disabled={ready === 0}>
              确认入库 ({ready})
            </Button>
          </Space>
        </Space>
      }
      style={{ top: 20 }}
      styles={{ body: { maxHeight: '70vh', overflow: 'auto', padding: '12px 16px' } }}
    >
      {list.map(r => (
        <div key={r.key} style={{
          marginBottom: 10, padding: 10, borderRadius: 8,
          border: r.confirmed ? '2px solid #1677ff' : '1px solid #e8e8e8',
          background: r.confirmed ? '#f0f5ff' : '#fff'
        }}>
          {/* 行头 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input type="checkbox" checked={r.confirmed} onChange={() => toggleOne(r.key)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1677ff' }} />
            <Tag color={r.currency === 'CNY' ? 'red' : 'blue'}>{r.currency === 'CNY' ? '¥' : '$'}</Tag>
            <input type="date" value={r.date} onChange={e => upd(r.key, 'date', e.target.value)}
              style={{ width: 130, height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13 }} />
            <select value={r.category1} onChange={e => { upd(r.key, 'category1', e.target.value); upd(r.key, 'category2', '') }}
              style={{ height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <select value={r.category2} onChange={e => upd(r.key, 'category2', e.target.value)}
              style={{ height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
              {(categories.find(c => c.id === r.category1)?.children || []).map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
            <Text ellipsis style={{ maxWidth: 200, flex: 1 }}>{r.note}</Text>
            {r.items.length === 0 && <Tag color="orange">缺分摊人</Tag>}
          </div>

          {/* 分摊明细 */}
          <div style={{ marginLeft: 24 }}>
            {r.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                <select value={item.personName || ''} onChange={e => updItem(r.key, idx, 'personName', e.target.value)}
                  style={{ width: 110, height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 4px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
                  <option value="">选择人员</option>
                  {peopleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input type="number" min="0" step="0.01"
                  value={item.amount > 0 ? (item.amount / 100).toFixed(2) : ''}
                  onChange={e => updItem(r.key, idx, 'amount', Math.round(parseFloat(e.target.value || '0') * 100))}
                  style={{ width: 100, height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13 }}
                  placeholder="金额" />
                <input value={item.note || ''} onChange={e => updItem(r.key, idx, 'note', e.target.value)}
                  style={{ flex: 1, height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13, minWidth: 80 }}
                  placeholder="备注" />
              </div>
            ))}
            <Button size="small" type="dashed" onClick={() => addItem(r.key)} style={{ marginTop: 4 }}>
              + 添加分摊人
            </Button>
          </div>
        </div>
      ))}

      {/* 本次分账统计 */}
      {list.length > 0 && (() => {
        const pmap: Record<string, { cny: number; aud: number }> = {}
        for (const r of list) {
          if (!r.confirmed || r.items.length === 0) continue
          const cur = r.currency === 'CNY' ? 'cny' : 'aud'
          for (const item of r.items) {
            const name = item.personName || item.personId ? people.find(p => p.id === item.personId)?.name || '未知' : '未知'
            if (!pmap[name]) pmap[name] = { cny: 0, aud: 0 }
            pmap[name][cur] += item.amount
          }
        }
        const names = Object.keys(pmap)
        if (names.length === 0) return null
        return (
          <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 8, border: '1px solid #e8e8e8' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>📊 本次分账统计（已勾选 {confirmed} 条）</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8e8e8', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>人员</th>
                  <th style={{ padding: '4px 8px', color: '#cf1322' }}>🇨🇳 人民币</th>
                  <th style={{ padding: '4px 8px', color: '#1677ff' }}>🇦🇺 澳元</th>
                </tr>
              </thead>
              <tbody>
                {names.map(name => {
                  const d = pmap[name]
                  const hasCny = d.cny > 0
                  const hasAud = d.aud > 0
                  if (!hasCny && !hasAud) return null
                  return (
                    <tr key={name} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 500 }}>{name}</td>
                      <td style={{ padding: '4px 8px', color: hasCny ? '#cf1322' : '#ccc' }}>
                        {hasCny ? `¥${(d.cny / 100).toFixed(2)}` : '-'}
                      </td>
                      <td style={{ padding: '4px 8px', color: hasAud ? '#1677ff' : '#ccc' }}>
                        {hasAud ? `$${(d.aud / 100).toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}
      {list.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>无解析结果</div>}
    </Modal>
  )
}

// ============================================================
// 主页面
// ============================================================
export default function SmartInputPage() {
  const [text, setText] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [parsing, setParsing] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [parseError, setParseError] = useState('')
  const [results, setResults] = useState<ParsedExpense[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultDate, setDefaultDate] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`
  )
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('AUD')

  // 设置
  const [keyOpen, setKeyOpen] = useState(false)
  const [providerId, setProviderId] = useState('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [customEp, setCustomEp] = useState('')
  const [customModel, setCustomModel] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [ppl, cats] = await Promise.all([window.api.getPeople(), window.api.getCategories()])
      setPeople(ppl)
      setCategories(cats)
    } catch {
      message.error('加载基础数据失败，请重启应用')
    }
    // 设置加载失败不影响主功能
    try {
      const [pid, key, ep, m] = await Promise.all([
        window.api.getSetting('ai_provider'), window.api.getSetting('ai_api_key'),
        window.api.getSetting('ai_custom_endpoint'), window.api.getSetting('ai_custom_model')
      ])
      if (pid) setProviderId(pid)
      if (key) setApiKey(key)
      if (ep) setCustomEp(ep)
      if (m) setCustomModel(m)
    } catch { }
  }

  const saveSettings = async () => {
    await Promise.all([
      window.api.setSetting('ai_provider', providerId),
      window.api.setSetting('ai_api_key', apiKey),
      window.api.setSetting('ai_custom_endpoint', customEp),
      window.api.setSetting('ai_custom_model', customModel)
    ])
  }

  const provider = PROVIDERS.find(p => p.id === providerId) || PROVIDERS[0]
  const keyReady = !!(apiKey && apiKey.length > 10)

  // ---- 解析 ----
  const handleLocal = () => {
    if (!text.trim()) { message.warning('请先粘贴记账文字'); return }
    setParsing(true); setParseError('')
    try {
      const parsed = parseText(text, { people, defaultCurrency, defaultDate, categories })
      if (parsed.length === 0) { setParseError('本地解析未能识别，请尝试 AI 解析。'); return }
      setResults(parsed)
      setModalOpen(true)
    } catch (err: any) { setParseError(`出错：${err.message}`) }
    finally { setParsing(false) }
  }

  const handleAI = async () => {
    if (!text.trim()) { message.warning('请先粘贴记账文字'); return }
    if (!keyReady) { setKeyOpen(true); return }
    setAiLoading(true); setParseError('')
    try {
      const endpoint = provider.id === 'custom' ? customEp : provider.endpoint
      const model = provider.id === 'custom' ? customModel : provider.model
      const res = await window.api.aiParse(text, people, { endpoint, model, apiKey, providerId: provider.id, categories })
      if (!res.success) { setParseError(`AI 解析失败：${res.error}`); return }
      const parsed: ParsedExpense[] = res.expenses.map((e: any) => ({
        currency: e.currency as Currency,
        category1: e.category1, category2: e.category2, date: e.date, note: e.note || '',
        items: (e.items || []).map((item: any) => ({
          personName: item.personName,
          personId: people.find(p => p.name === item.personName)?.id,
          amount: Math.round((item.amount || 0) * 100), note: item.note || ''
        })), rawText: ''
      }))
      setResults(parsed)
      setModalOpen(true)
    } catch (err: any) { setParseError(`AI 解析出错：${err.message}`) }
    finally { setAiLoading(false) }
  }

  return (
    <div style={{ padding: 24, height: '100%' }}>
      {/* 输入区 */}
      <div style={{
        border: '1px solid #e8e8e8', borderRadius: 8, padding: 16, background: '#fff',
        maxWidth: 800, margin: '0 auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Space>
            <span style={{ fontWeight: 600, fontSize: 15 }}>📝 智能录入</span>
            {keyReady ? <Tag color="green">{provider.name}</Tag> : <Tag color="orange">AI 未配置</Tag>}
          </Space>
          <Button icon={<KeyOutlined />} size="small" onClick={() => setKeyOpen(true)}>
            {keyReady ? '换 Key' : '配置 AI'}
          </Button>
        </div>

        <Space style={{ marginBottom: 8 }} wrap>
          <input type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)}
            style={{ width: 140, height: 32, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 13 }} />
          <select value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value as Currency)}
            style={{ height: 32, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            <option value="AUD">🇦🇺 澳元</option>
            <option value="CNY">🇨🇳 人民币</option>
          </select>
        </Space>

        <TextArea value={text} onChange={e => setText(e.target.value)}
          placeholder="粘贴记账文字，例如：6月15号打车13.75刀 四个人平分..." rows={8} style={{ fontSize: 14 }} />

        {aiLoading && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 28 }} spin />} />
            <div style={{ marginTop: 8, color: '#1677ff', fontSize: 14, fontWeight: 500 }}>
              🤖 正在调用 {provider.name} AI 解析... 预计 3-10 秒
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <Button icon={<ThunderboltOutlined />} onClick={handleLocal} loading={parsing && !aiLoading} disabled={aiLoading}>
            本地解析
          </Button>
          <Button type="primary" icon={<RobotOutlined />} onClick={handleAI} loading={aiLoading} disabled={parsing && !aiLoading}>
            {aiLoading ? 'AI 解析中...' : `AI 解析 (${provider.name})`}
          </Button>
        </div>

        {parseError && <Alert message={parseError} type="error" showIcon closable style={{ marginTop: 8 }} onClose={() => setParseError('')} />}
      </div>

      {/* 结果弹窗 */}
      <ResultModal
        open={modalOpen}
        results={results}
        people={people}
        categories={categories}
        onClose={() => setModalOpen(false)}
        onSubmit={() => { }}
      />

      {/* 设置弹窗 */}
      <Modal title="⚙️ AI 解析设置" open={keyOpen} onCancel={() => setKeyOpen(false)}
        onOk={() => { saveSettings(); setKeyOpen(false); message.success('设置已保存！') }}
        okText="保存" cancelText="取消" width={520}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>AI 提供商</Text>
            <select value={providerId} onChange={e => setProviderId(e.target.value)}
              style={{ width: '100%', height: 36, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 14, marginTop: 4, background: '#fff', cursor: 'pointer' }}>
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {providerId === 'custom' ? (
            <>
              <div>
                <Text strong>接口地址</Text>
                <input value={customEp} onChange={e => setCustomEp(e.target.value)} placeholder="https://api.openai.com/v1/chat/completions"
                  style={{ width: '100%', height: 32, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <Text strong>模型名</Text>
                <input value={customModel} onChange={e => setCustomModel(e.target.value)} placeholder="gpt-4o-mini"
                  style={{ width: '100%', height: 32, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 13, marginTop: 4 }} />
              </div>
            </>
          ) : (
            <Alert type="info" style={{ fontSize: 12 }}
              message={`接口：${provider.endpoint}\n模型：${provider.model}`} />
          )}

          <div>
            <Text strong>{provider.label}</Text>
            <Input.Password value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="输入 API Key" style={{ fontFamily: 'monospace', marginTop: 4 }} />
          </div>

          <Alert type="info" showIcon style={{ fontSize: 12 }}
            message={
              <div>
                <div>💡 费用：{provider.cost}</div>
                {provider.url && <div>🔗 获取 Key：{provider.url}</div>}
                <div style={{ marginTop: 4 }}>🔒 Key 保存在本地数据库，打包给别人不会泄露</div>
              </div>
            } />
        </Space>
      </Modal>
    </div>
  )
}

interface EditableExpense extends ParsedExpense { key: string; confirmed: boolean }
