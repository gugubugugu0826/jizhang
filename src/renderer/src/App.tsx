import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, ConfigProvider } from 'antd'
import {
  WalletOutlined,
  PieChartOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  DollarOutlined,
  HistoryOutlined,
  AccountBookOutlined
} from '@ant-design/icons'
import { useState } from 'react'
import zhCN from 'antd/locale/zh_CN'
import HomePage from './pages/HomePage'
import StatisticsPage from './pages/StatisticsPage'
import SettingsPage from './pages/SettingsPage'
import SmartInputPage from './pages/SmartInputPage'
import PeopleManagePage from './pages/PeopleManagePage'
import SettlementPage from './pages/SettlementPage'
import BalancePage from './pages/BalancePage'
import HistoryPage from './pages/HistoryPage'

const { Header, Sider, Content } = Layout

function App(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    { key: '/smart-input', icon: <ThunderboltOutlined />, label: '智能录入' },
    { key: '/', icon: <WalletOutlined />, label: '花销记录' },
    { key: '/statistics', icon: <PieChartOutlined />, label: '统计分析' },
    { key: '/settlement', icon: <DollarOutlined />, label: '分账结算' },
    { key: '/balance', icon: <AccountBookOutlined />, label: '欠款结余' },
    { key: '/history', icon: <HistoryOutlined />, label: '变动记录' },
    { key: '/people', icon: <TeamOutlined />, label: '人员管理' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' }
  ]

  const pathToKey = (p: string) => {
    if (p === '/smart-input') return '/smart-input'
    if (p === '/people') return '/people'
    if (p === '/statistics') return '/statistics'
    if (p === '/settlement') return '/settlement'
    if (p === '/balance') return '/balance'
    if (p === '/history') return '/history'
    if (p === '/settings') return '/settings'
    return '/'
  }
  const selectedKey = pathToKey(location.pathname)
  const currentLabel = menuItems.find(item => item.key === selectedKey)?.label || '记账'

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light"
          style={{ borderRight: '1px solid #f0f0f0', userSelect: 'none' }}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
            onClick={() => navigate('/')}>
            <h1 style={{ margin: 0, fontSize: collapsed ? 18 : 22, fontWeight: 700,
              color: '#1677ff', whiteSpace: 'nowrap' }}>
              {collapsed ? '💰' : '💰 记账'}
            </h1>
          </div>
          <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems}
            onClick={({ key }) => navigate(key)} style={{ borderRight: 0, marginTop: 8 }} />
        </Sider>
        <Layout>
          <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}>{currentLabel}</span>
          </Header>
          <Content style={{ background: '#f5f5f5', overflow: 'auto' }}>
            <Routes>
              <Route path="/smart-input" element={<SmartInputPage />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/settlement" element={<SettlementPage />} />
              <Route path="/balance" element={<BalancePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/people" element={<PeopleManagePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

export default App
