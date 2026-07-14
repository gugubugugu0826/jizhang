import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Tag, Popconfirm, message, Select, DatePicker, Space, Card, Tooltip } from 'antd'
import { PlusOutlined, DeleteOutlined, ReloadOutlined, ClearOutlined } from '@ant-design/icons'
import type { Expense, Category, NewExpense, Person, Currency } from '../../../shared/types'
import AddExpenseModal from '../components/AddExpenseModal'

const { RangePicker } = DatePicker

export default function HomePage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [filterCategory, setFilterCategory] = useState<string | undefined>()
  const [filterPerson, setFilterPerson] = useState<number | undefined>()
  const [filterCurrency, setFilterCurrency] = useState<Currency | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const pageSize = 20

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, ppl] = await Promise.all([window.api.getCategories(), window.api.getPeople()])
      setCategories(cats); setPeople(ppl)
      const result = await window.api.getExpenses({
        currency: filterCurrency, personId: filterPerson, category1: filterCategory,
        startDate: dateRange?.[0], endDate: dateRange?.[1],
        limit: pageSize, offset: (page - 1) * pageSize
      })
      setExpenses(result.expenses); setTotal(result.total)
      setSelectedIds([])
    } catch (err) { message.error('加载失败') }
    finally { setLoading(false) }
  }, [filterCategory, filterPerson, filterCurrency, dateRange, page])

  useEffect(() => { loadData() }, [loadData])

  const handleAdd = async (expense: NewExpense) => {
    try { await window.api.addExpense(expense); setPage(1); loadData() } catch { message.error('添加失败') }
  }

  const handleDelete = async (id: number) => {
    try { await window.api.deleteExpense(id); message.success('已删除'); loadData() } catch { message.error('删除失败') }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) { message.warning('请先勾选记录'); return }
    try {
      const n = await window.api.deleteExpenses(selectedIds)
      message.success(`已删除 ${n} 条记录`)
      setSelectedIds([])
      loadData()
    } catch { message.error('删除失败') }
  }

  const handleDeleteAll = async () => {
    try {
      const n = await window.api.deleteAllExpenses()
      message.success(`已删除全部 ${n} 条记录`)
      loadData()
    } catch { message.error('删除失败') }
  }

  const cs = (c: string) => c === 'CNY' ? '¥' : '$'
  const cc = (c: string) => c === 'CNY' ? '#cf1322' : '#1677ff'

  const getCat = (cat1: string, cat2: string) => {
    const c1 = categories.find(c => c.id === cat1)
    const c2 = c1?.children.find(c => c.id === cat2)
    return { n1: c1?.name ?? cat1, i1: c1?.icon ?? '', n2: c2?.name ?? cat2 }
  }

  const columns = [
    {
      title: '金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 110,
      render: (a: number, r: Expense) => (
        <span style={{ color: cc(r.currency), fontWeight: 600, fontSize: 15 }}>{cs(r.currency)}{(a / 100).toFixed(2)}</span>
      )
    },
    {
      title: '币种', dataIndex: 'currency', key: 'currency', width: 55,
      render: (c: string) => <Tag color={c === 'CNY' ? 'red' : 'blue'}>{c}</Tag>
    },
    {
      title: '分类', key: 'cat', width: 130,
      render: (_: any, r: Expense) => { const { n1, i1, n2 } = getCat(r.category1, r.category2); return <span>{i1} {n1}·{n2}</span> }
    },
    {
      title: '分摊人', key: 'ppl', width: 180,
      render: (_: any, r: Expense) => (
        <Space size={2} wrap>
          {r.items.map(item => (
            <Tooltip key={item.id} title={`${cs(r.currency)}${(item.amount / 100).toFixed(2)}`}>
              <Tag>{item.personName}</Tag>
            </Tooltip>
          ))}
        </Space>
      )
    },
    {
      title: '日期', dataIndex: 'date', key: 'date', width: 100,
      sorter: (a: Expense, b: Expense) => a.date.localeCompare(b.date), defaultSortOrder: 'descend' as const
    },
    {
      title: '备注', dataIndex: 'note', key: 'note', ellipsis: true, render: (n: string) => n || '-'
    },
    {
      title: '', key: 'act', width: 40,
      render: (_: any, r: Expense) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ]

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select placeholder="币种" value={filterCurrency} onChange={v => { setFilterCurrency(v); setPage(1) }}
            options={[{ value: 'CNY', label: '¥ 人民币' }, { value: 'AUD', label: '$ 澳元' }]}
            style={{ width: 120 }} allowClear />
          <Select placeholder="人员" value={filterPerson} onChange={v => { setFilterPerson(v); setPage(1) }}
            options={people.map(p => ({ value: p.id, label: p.name }))}
            style={{ width: 110 }} allowClear />
          <Select placeholder="分类" value={filterCategory} onChange={v => { setFilterCategory(v); setPage(1) }}
            options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
            style={{ width: 140 }} allowClear />
          <RangePicker placeholder={['开始', '结束']} format="YYYY-MM-DD"
            onChange={d => { setDateRange(d && d[0] && d[1] ? [d[0].format('YYYY-MM-DD'), d[1].format('YYYY-MM-DD')] : null); setPage(1) }}
            allowClear />
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加花销</Button>
        </Space>
      </Card>

      {/* 批量操作栏 */}
      {selectedIds.length > 0 && (
        <div style={{ marginBottom: 8, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>已选 <Tag color="orange">{selectedIds.length} 条</Tag></span>
          <Space>
            <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>删除选中</Button>
            <Button onClick={() => setSelectedIds([])}>取消选择</Button>
          </Space>
        </div>
      )}

      <Card size="small" style={{ flex: 1, overflow: 'auto' }} bodyStyle={{ padding: 0 }}>
        <Table dataSource={expenses} columns={columns} rowKey="id" loading={loading} size="middle"
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: keys => setSelectedIds(keys as number[])
          }}
          pagination={{
            current: page, pageSize, total, onChange: p => setPage(p),
            showTotal: t => `共 ${t} 条`
          }}
          locale={{ emptyText: '暂无花销记录' }}
          footer={() => total > 0 ? (
            <div style={{ textAlign: 'right' }}>
              <Popconfirm title="⚠️ 确定删除所有花销记录？此操作不可撤销！"
                onConfirm={handleDeleteAll} okText="确定删除全部" cancelText="取消"
                okButtonProps={{ danger: true }}>
                <Button danger icon={<ClearOutlined />} size="small">一键删除所有 ({total} 条)</Button>
              </Popconfirm>
            </div>
          ) : undefined}
        />
      </Card>

      <AddExpenseModal open={modalOpen} onClose={() => setModalOpen(false)}
        onSubmit={handleAdd} categories={categories} people={people} />
    </div>
  )
}
