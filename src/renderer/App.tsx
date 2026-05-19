import { useState, useEffect, useCallback } from 'react'
import { Layout, ConfigProvider, theme, message } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import Header from './components/Header/Header'
import { ChatContainer, InputArea } from './components/Chat'
import type { Message } from './components/Chat'
import './styles/global.css'

const { Content } = Layout

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
  },
}

interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
}

const workflowPrompts = {
  tuning: '请输入需要调优的 SQL 语句，我会分析并给出优化建议。',
  report: '请描述您需要创建的测试报告需求，我会帮您生成测试用例并执行。',
  chat: '有什么可以帮您的？',
}

export default function App() {
  const [currentWorkflow, setCurrentWorkflow] = useState('tuning')
  const [currentCluster, setCurrentCluster] = useState<Cluster | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Add welcome message
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      type: 'assistant',
      content: `欢迎使用 DWS Client！\n\n当前工作流: ${currentWorkflow === 'tuning' ? 'DWS 调优' : currentWorkflow === 'report' ? '测试报告' : '通用对话'}\n\n${workflowPrompts[currentWorkflow as keyof typeof workflowPrompts]}`,
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
  }, [])

  useEffect(() => {
    // Update welcome message when workflow changes
    if (messages.length === 1 && messages[0].id.startsWith('welcome')) {
      setMessages([{
        ...messages[0],
        content: `欢迎使用 DWS Client！\n\n当前工作流: ${currentWorkflow === 'tuning' ? 'DWS 调优' : currentWorkflow === 'report' ? '测试报告' : '通用对话'}\n\n${workflowPrompts[currentWorkflow as keyof typeof workflowPrompts]}`,
      }])
    }
  }, [currentWorkflow])

  const handleSend = useCallback(async (input: string) => {
    if (!input.trim()) return

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    // Add thinking message
    const thinkingMessage: Message = {
      id: `thinking-${Date.now()}`,
      type: 'thinking',
      content: '正在分析...',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, thinkingMessage])
    setLoading(true)

    try {
      if (currentWorkflow === 'tuning') {
        await handleTuningWorkflow(input, thinkingMessage.id)
      } else if (currentWorkflow === 'report') {
        await handleReportWorkflow(input, thinkingMessage.id)
      } else {
        await handleChatWorkflow(input, thinkingMessage.id)
      }
    } catch (error: any) {
      updateMessage(thinkingMessage.id, {
        type: 'error',
        content: `错误: ${error.message}`,
      })
    } finally {
      setLoading(false)
    }
  }, [currentWorkflow, currentCluster])

  const handleTuningWorkflow = async (input: string, thinkingId: string) => {
    // Send to LLM for analysis
    const response = await window.electronAPI?.llmChat([
      { role: 'system', content: '你是一个 SQL 调优专家。用户会输入 SQL 语句，你需要分析并给出优化建议。' },
      { role: 'user', content: input }
    ])

    if (response.success) {
      updateMessage(thinkingId, {
        type: 'assistant',
        content: response.content || '分析完成',
      })
    } else {
      updateMessage(thinkingId, {
        type: 'error',
        content: response.error || '调优分析失败',
      })
    }
  }

  const handleReportWorkflow = async (input: string, thinkingId: string) => {
    const response = await window.electronAPI?.llmChat([
      { role: 'system', content: '你是一个测试工程师。用户会描述测试需求，你需要生成测试用例。' },
      { role: 'user', content: input }
    ])

    if (response.success) {
      updateMessage(thinkingId, {
        type: 'assistant',
        content: response.content || '测试用例已生成',
      })
    } else {
      updateMessage(thinkingId, {
        type: 'error',
        content: response.error || '测试用例生成失败',
      })
    }
  }

  const handleChatWorkflow = async (input: string, thinkingId: string) => {
    const response = await window.electronAPI?.llmChat([
      { role: 'user', content: input }
    ])

    if (response.success) {
      updateMessage(thinkingId, {
        type: 'assistant',
        content: response.content || '收到',
      })
    } else {
      updateMessage(thinkingId, {
        type: 'error',
        content: response.error || '对话失败',
      })
    }
  }

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ))
  }

  const handleStop = () => {
    setLoading(false)
    message.info('已停止')
  }

  return (
    <ConfigProvider theme={lightTheme}>
      <Layout className="app-layout">
        <Header
          currentWorkflow={currentWorkflow}
          onWorkflowChange={setCurrentWorkflow}
          currentCluster={currentCluster}
          onClusterChange={setCurrentCluster}
        />

        <Content className="app-main">
          <ChatContainer messages={messages} />
          <InputArea
            onSend={handleSend}
            onStop={handleStop}
            loading={loading}
            disabled={!currentCluster}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
