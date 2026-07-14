import { useState, useEffect } from 'react'
import { Card, DatePicker, Button, Space, message, Table, Tag, Row, Col } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { Person } from '../../../shared/types'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

interface PersonTotal {
  personId: number
  personName: string
  cnyTotal: number  // 分
  cnyCount: number
  audTotal: number  // 分
  audCount: number
}

export default function SettlementPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [data, setData] = useState<PersonTotal[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  useEffect(() => { loadPeople() }, [])
  useEffect(() => { if (people.length > 0) loadData() }, [dateRange, people])

  const loadPeople = async () => {
    try { setPeople(await window.api.getPeople()) } catch {}
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const params = dateRange ? { startDate: dateRange[0], endDate: dateRange[1] } : undefined

      const [cnyStats, audStats] = await Promise.all([
        window.api.getPersonStats({ ...params, currency: 'CNY' }),
        window.api.getPersonStats({ ...params, currency: 'AUD' })
      ])

      // 按人合并
      const map = new Map<number, PersonTotal>()

      // 先初始化所有人（包括没有消费的人）
      for (const p of people) {
        map.set(p.id, { personId: p.id, personName: p.name, cnyTotal: 0, cnyCount: 0, audTotal: 0, audCount: 0 })
      }

      for (const s of cnyStats) {
        const entry = map.get(s.personId) || { personId: s.personId, personName: s.personName, cnyTotal: 0, cnyCount: 0, audTotal: 0, audCount: 0 }
        entry.cnyTotal = s.totalAmount
        entry.cnyCount = s.count
        map.set(s.personId, entry)
      }

      for (const s of audStats) {
        const entry = map.get(s.personId) || { personId: s.personId, personName: s.personName, cnyTotal: 0, cnyCount: 0, audTotal: 0, audCount: 0 }
        entry.audTotal = s.totalAmount
        entry.audCount = s.count
        map.set(s.personId, entry)
      }

      // 按 CNY 总额降序排序（不混合 AUD）
      setData([...map.values()].sort((a, b) => b.cnyTotal - a.cnyTotal))
    } catch (err) {
      message.error('加载失败')
    } finally { setLoading(false) }
  }

  const totalCny = data.reduce((s, d) => s + d.cnyTotal, 0)
  const totalAud = data.reduce((s, d) => s + d.audTotal, 0)

  const columns = [
    {
      title: '人员', dataIndex: 'personName', key: 'name', width: 120,
      render: (name: string) => <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
    },
    {
      title: '🇨🇳 人民币 (¥)', key: 'cny', width: 180,
      render: (_: any, r: PersonTotal) => (
        <span style={{ color: '#cf1322', fontWeight: r.cnyTotal > 0 ? 600 : 400, fontSize: 15 }}>
          ¥{(r.cnyTotal / 100).toFixed(2)}
          {r.cnyCount > 0 && <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>({r.cnyCount}笔)</span>}
        </span>
      )
    },
    {
      title: '🇦🇺 澳元 ($)', key: 'aud', width: 180,
      render: (_: any, r: PersonTotal) => (
        <span style={{ color: '#1677ff', fontWeight: r.audTotal > 0 ? 600 : 400, fontSize: 15 }}>
          ${(r.audTotal / 100).toFixed(2)}
          {r.audCount > 0 && <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>({r.audCount}笔)</span>}
        </span>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ fontWeight: 500 }}>📅 结算周期：</span>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            format="YYYY-MM-DD"
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
              } else {
                setDateRange(null)
              }
            }}
            allowClear
            value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small" style={{ textAlign: 'center', background: '#fff7e6' }}>
            <div style={{ fontSize: 13, color: '#999' }}>🇨🇳 人民币总计</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#cf1322' }}>
              ¥{(totalCny / 100).toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" style={{ textAlign: 'center', background: '#e6f4ff' }}>
            <div style={{ fontSize: 13, color: '#999' }}>🇦🇺 澳元总计</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>
              ${(totalAud / 100).toFixed(2)}
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="👥 每人应付明细">
        <Table
          dataSource={data}
          columns={columns}
          rowKey="personId"
          loading={loading}
          pagination={false}
          size="middle"
          summary={() => (
            <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
              <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <span style={{ color: '#cf1322', fontSize: 16 }}>¥{(totalCny / 100).toFixed(2)}</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <span style={{ color: '#1677ff', fontSize: 16 }}>${(totalAud / 100).toFixed(2)}</span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
          locale={{ emptyText: dateRange ? '该时间段内无消费记录' : '请选择日期范围查看分账' }}
        />
      </Card>
    </div>
  )
}
