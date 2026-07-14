import { useState, useEffect } from 'react'
import { Card, Typography, Divider, InputNumber, Button, message, Space, Tag } from 'antd'
import type { ExchangeRate } from '../../../shared/types'

const { Title, Paragraph, Text } = Typography

export default function SettingsPage() {
  const [rate, setRate] = useState(4.8)
  const [loading, setLoading] = useState(false)
  const [currentRate, setCurrentRate] = useState<ExchangeRate | null>(null)

  useEffect(() => {
    loadRate()
  }, [])

  const loadRate = async () => {
    try {
      const r = await window.api.getExchangeRate('AUD', 'CNY')
      setCurrentRate(r || null)
      if (r) setRate(r.rate)
    } catch (err) { /* ignore */ }
  }

  const handleSaveRate = async () => {
    setLoading(true)
    try {
      const r = await window.api.setExchangeRate('AUD', 'CNY', rate)
      setCurrentRate(r)
      message.success('汇率已更新')
    } catch (err) {
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title="💱 汇率设置" style={{ maxWidth: 600, marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>澳元 (AUD) → 人民币 (CNY)</Text>
          </div>
          <Space>
            <span>1 AUD =</span>
            <InputNumber
              value={rate}
              onChange={v => setRate(v || 0)}
              min={0.01}
              step={0.01}
              precision={2}
              style={{ width: 120 }}
            />
            <span>CNY</span>
            <Button type="primary" onClick={handleSaveRate} loading={loading}>
              保存汇率
            </Button>
          </Space>
          {currentRate && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前汇率：1 AUD = {currentRate.rate} CNY（{currentRate.createdAt}）
            </Text>
          )}
        </Space>
      </Card>

      <Card title="关于记账" style={{ maxWidth: 600 }}>
        <Title level={4}>💰 记账 APP v2</Title>
        <Text type="secondary">版本 2.0.0</Text>
        <Divider />
        <Paragraph>记账APP 是一款支持多币种、多人分摊的个人财务管理工具。</Paragraph>
        <Divider />
        <Paragraph><Text strong>技术栈：</Text></Paragraph>
        <ul>
          <li><Tag>Electron 33</Tag></li>
          <li><Tag>React 19</Tag> + <Tag>TypeScript</Tag></li>
          <li><Tag>Ant Design 6</Tag></li>
          <li><Tag>ECharts 6</Tag></li>
          <li><Tag>SQLite</Tag></li>
        </ul>
      </Card>
    </div>
  )
}
