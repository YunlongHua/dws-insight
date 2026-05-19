import { useState } from 'react'
import { Layout, ConfigProvider, theme, Menu } from 'antd'
import {
  CloudServerOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SettingOutlined
} from '@ant-design/icons'
import ClusterPanel from './components/Cluster/ClusterPanel'
import LLMPanel from './components/LLM/LLMPanel'
import TuningPanel from './components/Tuning/TuningPanel'
import ReportPanel from './components/Report/ReportPanel'
import HistoryPanel from './components/History/HistoryPanel'
import './styles/global.css'

type MenuItem = {
  key: string
  icon: React.ReactNode
  label: string
}

const { Sider, Content } = Layout

const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8fafc',
    colorBorder: '#e2e8f0',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    borderRadius: 6,
    fontFamily: "'Inter', 'Microsoft YaHei', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 32,
      paddingContentHorizontal: 12,
    },
    Select: {
      borderRadius: 6,
      controlHeight: 28,
    },
    Input: {
      borderRadius: 6,
    },
  },
}

const menuItems: MenuItem[] = [
  { key: 'clusters', icon: <CloudServerOutlined />, label: '集群管理' },
  { key: 'llm', icon: <RobotOutlined />, label: '大模型配置' },
  { key: 'tuning', icon: <ThunderboltOutlined />, label: 'DWS 调优' },
  { key: 'report', icon: <FileTextOutlined />, label: '测试报告' },
  { key: 'history', icon: <HistoryOutlined />, label: '历史记录' },
]

export default function App() {
  const [activeView, setActiveView] = useState('clusters')

  const renderContent = () => {
    switch (activeView) {
      case 'clusters':
        return <ClusterPanel />
      case 'llm':
        return <LLMPanel />
      case 'tuning':
        return <TuningPanel />
      case 'report':
        return <ReportPanel />
      case 'history':
        return <HistoryPanel />
      default:
        return <ClusterPanel />
    }
  }

  return (
    <ConfigProvider theme={lightTheme}>
      <Layout style={{ height: '100vh' }}>
        <Sider
          width={220}
          style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.5px'
            }}>
              DWS Client
            </span>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[activeView]}
            onClick={({ key }) => setActiveView(key)}
            style={{
              background: 'transparent',
              borderRight: 'none',
              marginTop: 8,
            }}
            items={menuItems.map(item => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
              style: {
                margin: '4px 12px',
                borderRadius: 8,
                height: 44,
                lineHeight: '44px',
              }
            }))}
          />
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            padding: '12px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}>
            <SettingOutlined style={{ color: '#94a3b8' }} />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>设置</span>
          </div>
        </Sider>
        <Layout>
          <Content style={{
            padding: 24,
            background: '#f8fafc',
            overflow: 'auto',
          }}>
            <div style={{
              maxWidth: 1400,
              margin: '0 auto',
            }}>
              {renderContent()}
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}
