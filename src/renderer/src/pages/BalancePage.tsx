import { useState, useEffect } from 'react'
import { Card, Button, Table, Tag, Space, message, Modal, InputNumber, Input } from 'antd'
import { ReloadOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons'
import type { Person, Currency } from '../../../shared/types'

export default function BalancePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [cnyBalances, setCnyBalances] = useState<any[]>([])
  const [audBalances, setAudBalances] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualPerson, setManualPerson] = useState<number>(0)
  const [manualCurrency, setManualCurrency] = useState<Currency>('AUD')
  const [manualAmount, setManualAmount] = useState(0)
  const [manualNote, setManualNote] = useState('')
  const [manualDirection, setManualDirection] = useState<'owe' | 'lend'>('owe')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      setPeople(await window.api.getPeople())
      const [cny, aud] = await Promise.all([
        window.api.getBalances('CNY'),
        window.api.getBalances('AUD')
      ])
      setCnyBalances(cny)
      setAudBalances(aud)
    } catch (err) { message.error('加载失败') }
    finally { setLoading(false) }
  }

  const handleSettle = async (personId: number, currency: Currency) => {
    try {
      await window.api.settlePerson(personId, currency)
      message.success('已清账！')
      loadAll()
    } catch { message.error('清账失败') }
  }

  const handleManual = async () => {
    if (!manualPerson || manualAmount <= 0) { message.warning('请选择人员和金额'); return }
    try {
      // owe = 正数 = 对方欠我；lend = 负数 = 我欠对方
      const amount = manualDirection === 'owe' ? Math.round(manualAmount * 100) : -Math.round(manualAmount * 100)
      const dirLabel = manualDirection === 'owe' ? '欠我' : '我欠'
      await window.api.addManualBalance(manualPerson, manualCurrency, amount, manualNote || `${dirLabel} ${manualAmount} ${manualCurrency}`)
      message.success('手动记录已添加！')
      setManualOpen(false)
      loadAll()
    } catch { message.error('添加失败') }
  }

  const balanceColumns = (currency: Currency) => [
    {
      title: '人员', dataIndex: 'personName', key: 'name', width: 110,
      render: (n: string) => <span style={{ fontWeight: 600 }}>{n}</span>
    },
    {
      title: currency === 'CNY' ? '¥ 人民币余额' : '$ 澳元余额',
      dataIndex: 'balance', key: 'balance',
      render: (b: number) => {
        const color = b > 0 ? '#cf1322' : b < 0 ? '#389e0d' : '#999'
        const prefix = b > 0 ? '欠我 ' : b < 0 ? '我欠 ' : ''
        const absVal = `${currency === 'CNY' ? '¥' : '$'}${(Math.abs(b) / 100).toFixed(2)}`
        return (
          <span style={{ color, fontWeight: b !== 0 ? 600 : 400, fontSize: 15 }}>
            {b !== 0 ? prefix : ''}{absVal}
            {b === 0 && <span style={{ color: '#999' }}>已结清</span>}
          </span>
        )
      }
    },
    {
      title: '操作', key: 'act', width: 80,
      render: (_: any, r: any) => (
        <Button size="small" icon={<CheckOutlined />} disabled={r.balance === 0}
          onClick={() => handleSettle(r.personId, currency)}>
          清账
        </Button>
      )
    }
  ]

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>💰 欠款结余</span>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => { setManualOpen(true); setManualAmount(0); setManualNote(''); setManualDirection('owe') }}>
            手动记账
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>刷新</Button>
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="🇨🇳 人民币" size="small">
          <Table dataSource={cnyBalances} columns={balanceColumns('CNY')}
            rowKey="personId" pagination={false} size="small" loading={loading}
            locale={{ emptyText: '暂无数据' }} />
        </Card>
        <Card title="🇦🇺 澳元" size="small">
          <Table dataSource={audBalances} columns={balanceColumns('AUD')}
            rowKey="personId" pagination={false} size="small" loading={loading}
            locale={{ emptyText: '暂无数据' }} />
        </Card>
      </div>

      {/* 手动记账弹窗 */}
      <Modal title="✏️ 手动记账" open={manualOpen} onCancel={() => setManualOpen(false)}
        onOk={handleManual} okText="确认添加" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <span style={{ fontWeight: 500 }}>人员</span>
            <select value={manualPerson || ''} onChange={e => setManualPerson(parseInt(e.target.value))}
              style={{ width: '100%', height: 34, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 14, marginTop: 4, background: '#fff' }}>
              <option value="">选择人员</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <span style={{ fontWeight: 500 }}>类型</span>
            <select value={manualDirection} onChange={e => setManualDirection(e.target.value as any)}
              style={{ width: '100%', height: 34, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 14, marginTop: 4, background: '#fff' }}>
              <option value="owe">对方欠我（我要收回）</option>
              <option value="lend">我欠对方（我要还给对方）</option>
            </select>
          </div>
          <div>
            <span style={{ fontWeight: 500 }}>币种</span>
            <select value={manualCurrency} onChange={e => setManualCurrency(e.target.value as Currency)}
              style={{ width: '100%', height: 34, border: '1px solid #d9d9d9', borderRadius: 6, padding: '0 8px', fontSize: 14, marginTop: 4, background: '#fff' }}>
              <option value="AUD">🇦🇺 澳元</option>
              <option value="CNY">🇨🇳 人民币</option>
            </select>
          </div>
          <div>
            <span style={{ fontWeight: 500 }}>金额 ({manualCurrency === 'CNY' ? '元' : '刀'})</span>
            <InputNumber value={manualAmount} onChange={v => setManualAmount(v || 0)}
              min={0} step={0.01} precision={2} style={{ width: '100%', marginTop: 4 }}
              prefix={manualCurrency === 'CNY' ? '¥' : '$'} />
          </div>
          <div>
            <span style={{ fontWeight: 500 }}>原因（可选）</span>
            <Input.TextArea value={manualNote} onChange={e => setManualNote(e.target.value)}
              placeholder="例如：借了刘承洲300刀" rows={2} style={{ marginTop: 4 }} />
          </div>
        </Space>
      </Modal>
    </div>
  )
}
