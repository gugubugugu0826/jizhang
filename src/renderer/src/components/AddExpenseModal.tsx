import { useState, useEffect } from 'react'
import { Modal, Form, InputNumber, Select, DatePicker, Input, message, Button, Space } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Category, NewExpense, Person, Currency } from '../../../shared/types'
import dayjs from 'dayjs'

interface AddExpenseModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (expense: NewExpense) => void
  categories: Category[]
  people: Person[]
}

interface SplitItem {
  key: number
  personId: number | undefined
  amount: number
  note: string
}

let nextKey = 1

export default function AddExpenseModal({ open, onClose, onSubmit, categories, people }: AddExpenseModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [selectedCategory1, setSelectedCategory1] = useState<string | undefined>()
  const [currency, setCurrency] = useState<Currency>('AUD')
  const [splitItems, setSplitItems] = useState<SplitItem[]>([
    { key: nextKey++, personId: undefined, amount: 0, note: '' }
  ])

  useEffect(() => {
    if (open) {
      form.resetFields()
      setSelectedCategory1(undefined)
      setCurrency('AUD')
      setSplitItems([{ key: nextKey++, personId: undefined, amount: 0, note: '' }])
    }
  }, [open])

  const category2Options = selectedCategory1
    ? categories.find(c => c.id === selectedCategory1)?.children.map(c => ({
        value: c.id,
        label: c.name
      })) ?? []
    : []

  const addSplitItem = () => {
    setSplitItems(prev => [...prev, { key: nextKey++, personId: undefined, amount: 0, note: '' }])
  }

  const removeSplitItem = (key: number) => {
    setSplitItems(prev => prev.filter(item => item.key !== key))
  }

  const updateSplitItem = (key: number, field: string, value: any) => {
    setSplitItems(prev => prev.map(item =>
      item.key === key ? { ...item, [field]: value } : item
    ))
  }

  const quickSplit = (numPeople: number) => {
    const totalAmount = form.getFieldValue('amount')
    if (!totalAmount || totalAmount <= 0) {
      message.warning('请先输入总金额')
      return
    }
    const totalCents = Math.round(totalAmount * 100)
    const perPerson = Math.floor(totalCents / numPeople)
    const remainder = totalCents - perPerson * numPeople
    const items: SplitItem[] = people.slice(0, numPeople).map((p, i) => ({
      key: nextKey++,
      personId: p.id,
      amount: i === numPeople - 1 ? perPerson + remainder : perPerson,
      note: ''
    }))
    setSplitItems(items)
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()

      const validItems = splitItems.filter(item => item.personId && item.amount > 0)
      if (validItems.length === 0) {
        message.warning('请至少添加一个分摊人并输入金额')
        setLoading(false)
        return
      }

      const expense: NewExpense = {
        currency,
        category1: values.category1,
        category2: values.category2,
        date: values.date.format('YYYY-MM-DD'),
        note: values.note || '',
        items: validItems.map(item => ({
          personId: item.personId!,
          amount: item.amount,
          note: item.note
        }))
      }

      await onSubmit(expense)
      message.success('添加成功！')
      onClose()
    } catch (err: any) {
      if (err?.message) message.error(`添加失败：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = form.getFieldValue('amount')
  const splitTotal = splitItems.reduce((s, i) => s + (i.amount || 0), 0)
  const currencySymbol = currency === 'CNY' ? '¥' : '$'

  return (
    <Modal
      title="添加花销"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="确认添加"
      cancelText="取消"
      width={640}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          amount: undefined,
          category1: undefined,
          category2: undefined,
          date: dayjs(),
          note: ''
        }}
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <span>币种：</span>
          <Select
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'AUD', label: '🇦🇺 澳元 (AUD)' },
              { value: 'CNY', label: '🇨🇳 人民币 (CNY)' }
            ]}
            style={{ width: 160 }}
          />
        </Space>

        <Form.Item
          label={`总金额 (${currency === 'CNY' ? '元' : '刀'})`}
          name="amount"
          rules={[
            { required: true, message: '请输入金额' },
            { type: 'number', min: 0.01, message: '金额必须大于0' }
          ]}
        >
          <InputNumber
            prefix={currencySymbol}
            placeholder="0.00"
            style={{ width: '100%' }}
            min={0.01}
            step={0.01}
            precision={2}
          />
        </Form.Item>
        <Form.Item
          label="一级分类"
          name="category1"
          rules={[{ required: true, message: '请选择一级分类' }]}
        >
          <Select
            placeholder="选择分类"
            onChange={(value) => {
              setSelectedCategory1(value)
              form.setFieldValue('category2', undefined)
            }}
            options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
          />
        </Form.Item>
        <Form.Item
          label="二级分类"
          name="category2"
          rules={[{ required: true, message: '请选择二级分类' }]}
        >
          <Select
            placeholder={selectedCategory1 ? '选择小类' : '请先选择一级分类'}
            options={category2Options}
            disabled={!selectedCategory1}
          />
        </Form.Item>
        <Form.Item
          label="日期"
          name="date"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>
        <Form.Item label="备注" name="note">
          <Input.TextArea placeholder="可选：备注信息" maxLength={200} rows={2} />
        </Form.Item>
      </Form>

      {/* 分摊区域 */}
      <div style={{ marginTop: 8, border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong>👥 分摊明细</strong>
          <Space size={4}>
            <Button size="small" onClick={() => quickSplit(4)}>四人平分</Button>
            <Button size="small" onClick={() => quickSplit(3)}>三人平分</Button>
            <Button size="small" onClick={() => quickSplit(2)}>两人平分</Button>
            <Button size="small" onClick={() => quickSplit(people.length)}>全部平分</Button>
          </Space>
        </div>

        {splitItems.map((item) => (
          <Space key={item.key} style={{ marginBottom: 8, width: '100%' }} align="start">
            <Select
              value={item.personId}
              onChange={(v) => updateSplitItem(item.key, 'personId', v)}
              placeholder="选择人员"
              options={people.map(p => ({ value: p.id, label: p.name }))}
              style={{ width: 120 }}
            />
            <InputNumber
              value={item.amount > 0 ? item.amount / 100 : undefined}
              onChange={(v) => updateSplitItem(item.key, 'amount', Math.round((v || 0) * 100))}
              prefix={currencySymbol}
              placeholder="金额"
              min={0}
              step={0.01}
              precision={2}
              style={{ width: 140 }}
            />
            <Input
              value={item.note}
              onChange={(e) => updateSplitItem(item.key, 'note', e.target.value)}
              placeholder="备注"
              style={{ width: 160 }}
            />
            {splitItems.length > 1 && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeSplitItem(item.key)}
              />
            )}
          </Space>
        ))}

        <Button type="dashed" icon={<PlusOutlined />} onClick={addSplitItem} block size="small">
          添加分摊人
        </Button>
      </div>
    </Modal>
  )
}
