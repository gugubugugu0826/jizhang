import { useState, useEffect } from 'react'
import { Card, Table, Tag, Space, DatePicker, Button, message, Popconfirm } from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Person, Currency } from '../../../shared/types'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function HistoryPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filterPerson, setFilterPerson] = useState<number | undefined>()
  const [filterCurrency, setFilterCurrency] = useState<Currency | undefined>()
  const [filterType, setFilterType] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  useEffect(() => { loadPeople() }, [])
  useEffect(() => { loadData() }, [filterPerson, filterCurrency, filterType, dateRange])

  const loadPeople = async () => { try { setPeople(await window.api.getPeople()) } catch {} }

  const handleDelete = async (id: number) => {
    try {
      await window.api.deleteBalanceRecord(id)
      message.success('已删除')
      loadData()
    } catch { message.error('删除失败') }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterPerson) params.personId = filterPerson
      if (filterCurrency) params.currency = filterCurrency
      if (filterType) params.type = filterType
      if (dateRange) { params.startDate = dateRange[0]; params.endDate = dateRange[1] + ' 23:59:59' }
      setRecords(await window.api.getBalanceHistory(params))
    } catch (err) { message.error('加载失败') }
    finally { setLoading(false) }
  }

  const typeTag = (t: string) => {
    if (t === 'expense') return <Tag color="blue">花销分摊</Tag>
    if (t === 'manual') return <Tag color="orange">手动记账</Tag>
    if (t === 'settle') return <Tag color="green">清账</Tag>
    return <Tag>{t}</Tag>
  }

  const columns = [
    {
      title: '时间', dataIndex: 'created_at', key: 'time', width: 160,
      render: (t: string) => t?.substring(0, 16)
    },
    {
      title: '人员', dataIndex: 'personName', key: 'person', width: 90,
      render: (n: string) => <span style={{ fontWeight: 500 }}>{n}</span>
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 100,
      render: (t: string) => typeTag(t)
    },
    {
      title: '币种', dataIndex: 'currency', key: 'currency', width: 60,
      render: (c: string) => <Tag>{c}</Tag>
    },
    {
      title: '金额', dataIndex: 'amount', key: 'amount', width: 130,
      render: (a: number, r: any) => {
        const sym = r.currency === 'CNY' ? '¥' : '$'
        const color = a > 0 ? '#cf1322' : a < 0 ? '#389e0d' : '#999'
        return <span style={{ color, fontWeight: 600 }}>{sym}{(Math.abs(a) / 100).toFixed(2)}</span>
      }
    },
    {
      title: '备注', dataIndex: 'note', key: 'note',
      render: (n: string) => n || '-'
    },
    {
      title: '', key: 'act', width: 50,
      render: (_: any, r: any) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消">
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ]

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <span>人员：</span>
          <select value={filterPerson || ''} onChange={e => setFilterPerson(e.target.value ? parseInt(e.target.value) : undefined)}
            style={{ height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13, background: '#fff' }}>
            <option value="">全部</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span>币种：</span>
          <select value={filterCurrency || ''} onChange={e => setFilterCurrency((e.target.value || undefined) as any)}
            style={{ height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13, background: '#fff' }}>
            <option value="">全部</option>
            <option value="CNY">🇨🇳 CNY</option>
            <option value="AUD">🇦🇺 AUD</option>
          </select>
          <span>类型：</span>
          <select value={filterType || ''} onChange={e => setFilterType(e.target.value || undefined)}
            style={{ height: 30, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 6px', fontSize: 13, background: '#fff' }}>
            <option value="">全部</option>
            <option value="expense">花销分摊</option>
            <option value="manual">手动记账</option>
            <option value="settle">清账</option>
          </select>
          <span>日期：</span>
          <RangePicker placeholder={['开始', '结束']} format="YYYY-MM-DD"
            onChange={d => setDateRange(d && d[0] && d[1] ? [d[0].format('YYYY-MM-DD'), d[1].format('YYYY-MM-DD')] : null)}
            allowClear />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </Card>

      <Card title="📜 欠款变动记录" size="small" style={{ flex: 1, overflow: 'auto' }}>
        <Table dataSource={records} columns={columns} rowKey="id"
          loading={loading} size="small" pagination={{ pageSize: 50, showTotal: t => `共 ${t} 条` }}
          locale={{ emptyText: '暂无记录' }} />
      </Card>
    </div>
  )
}
