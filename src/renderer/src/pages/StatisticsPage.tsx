import { useState, useEffect } from 'react'
import { Card, DatePicker, Select, Space, message, Empty, Row, Col } from 'antd'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Currency, ExchangeRate } from '../../../shared/types'
import dayjs from 'dayjs'

echarts.use([PieChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const { RangePicker } = DatePicker

export default function StatisticsPage() {
  const [categoryStats, setCategoryStats] = useState<any[]>([])
  const [personStats, setPersonStats] = useState<any[]>([])
  const [monthlyStats, setMonthlyStats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState<Currency | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [rate, setRate] = useState<ExchangeRate | null>(null)

  useEffect(() => { loadData() }, [dateRange, currency])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = dateRange ? { startDate: dateRange[0], endDate: dateRange[1] } : undefined
      const p = params ? { ...params, currency } : { currency }

      const [catRaw, personRaw, monthlyRaw, exchangeRate] = await Promise.all([
        window.api.getCategoryStats(p),
        window.api.getPersonStats(p),
        window.api.getMonthlyStats(currency ? { ...params, currency, startMonth: params ? params.startDate.substring(0, 7) : undefined, endMonth: params ? params.endDate.substring(0, 7) : undefined } : undefined),
        window.api.getExchangeRate('AUD', 'CNY')
      ])

      const total = catRaw.reduce((s: number, c: any) => s + c.totalAmount, 0)
      setCategoryStats(catRaw.map((c: any) => ({ ...c, percentage: total > 0 ? c.totalAmount / total * 100 : 0 })))

      const personTotal = personRaw.reduce((s: number, p: any) => s + p.totalAmount, 0)
      setPersonStats(personRaw.map((p: any) => ({ ...p, percentage: personTotal > 0 ? p.totalAmount / personTotal * 100 : 0 })))

      setMonthlyStats(monthlyRaw.reverse())
      setRate(exchangeRate || null)
    } catch (err) {
      message.error('加载失败')
    } finally { setLoading(false) }
  }

  const sym = currency === 'CNY' || !currency ? '¥' : '$'

  const pieOption = (title: string, data: any[], nameField: string, valueField: string) => ({
    title: { text: title, left: 'center' },
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: any) => `${p.name}<br/>金额: ${sym}${(p.value / 100).toFixed(2)}<br/>占比: ${p.percent.toFixed(1)}%`
    },
    legend: { orient: 'vertical' as const, left: 'left', top: 30, type: 'scroll' as const },
    series: [{
      type: 'pie', radius: ['30%', '60%'], center: ['55%', '55%'],
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{d}%' },
      data: data.map(d => ({ name: d[nameField], value: d[valueField] }))
    }]
  })

  const barOption = {
    title: { text: '月度趋势', left: 'center' },
    tooltip: { trigger: 'axis' as const, formatter: (p: any[]) => `${p[0].name}<br/>${sym}${(p[0].value / 100).toFixed(2)}` },
    grid: { left: 60, right: 20, bottom: 30, top: 50 },
    xAxis: { type: 'category', data: monthlyStats.map((s: any) => s.month) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${sym}${(v / 100).toFixed(0)}` } },
    series: [{ type: 'bar', data: monthlyStats.map((s: any) => s.totalAmount), itemStyle: { borderRadius: [4, 4, 0, 0], color: '#1677ff' }, barMaxWidth: 40 }]
  }

  const totalAll = categoryStats.reduce((s: number, c: any) => s + c.totalAmount, 0)

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select placeholder="币种" value={currency} onChange={setCurrency}
            options={[{ value: 'CNY', label: '¥ 人民币' }, { value: 'AUD', label: '$ 澳元' }]}
            style={{ width: 130 }} allowClear />
          <RangePicker placeholder={['开始', '结束']} format="YYYY-MM-DD"
            onChange={(d) => setDateRange(d && d[0] && d[1] ? [d[0].format('YYYY-MM-DD'), d[1].format('YYYY-MM-DD')] : null)}
            allowClear />
        </Space>
      </Card>

      {categoryStats.length === 0 ? (
        <Card><Empty description="暂无数据" /></Card>
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: '#666' }}>总计支出：</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>{sym}{(totalAll / 100).toFixed(2)}</span>
              {rate && (
                <span style={{ color: '#999', marginLeft: 16, fontSize: 13 }}>
                  汇率：1 AUD = {rate.rate} CNY（仅参考）
                </span>
              )}
            </div>
          </Card>

          <Row gutter={16}>
            <Col span={8}>
              <Card><ReactEChartsCore echarts={echarts} option={pieOption('支出分类', categoryStats, 'categoryName', 'totalAmount')} style={{ height: 360 }} notMerge /></Card>
            </Col>
            <Col span={8}>
              <Card><ReactEChartsCore echarts={echarts} option={pieOption('人员支出', personStats, 'personName', 'totalAmount')} style={{ height: 360 }} notMerge /></Card>
            </Col>
            <Col span={8}>
              <Card><ReactEChartsCore echarts={echarts} option={barOption} style={{ height: 360 }} notMerge /></Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
