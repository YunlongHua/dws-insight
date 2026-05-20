import { useState, useEffect, useCallback } from 'react'
import { Layout, ConfigProvider, theme, message } from 'antd'
import Header from './components/Header/Header'
import { ChatContainer, InputArea } from './components/Chat'
import type { Message } from './components/Chat'
import './styles/global.css'

const { Content } = Layout

const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#4f8cff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f0f2f5',
    colorBorder: '#e8e8e8',
    colorText: '#1a1a1a',
    colorTextSecondary: '#666666',
    borderRadius: 10,
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

interface LLMConfig {
  id?: string
  name?: string
  provider: 'openai' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

const workflowPrompts = {
  tuning: '请输入需要调优的 SQL 语句，我会分析并给出优化建议。',
  report: '请描述您需要创建的测试报告需求，我会帮您生成测试用例并执行。',
}

export default function App() {
  const [currentWorkflow, setCurrentWorkflow] = useState('tuning')
  const [currentCluster, setCurrentCluster] = useState<Cluster | undefined>()
  const [modelConfig, setModelConfig] = useState<LLMConfig | undefined>()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      type: 'assistant',
      content: `欢迎使用 DWS Insight！\n\n${workflowPrompts[currentWorkflow as keyof typeof workflowPrompts]}`,
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
  }, [])
  useEffect(() => {
    if (messages.length === 1 && messages[0].id.startsWith('welcome')) {
      setMessages([{
        ...messages[0],
        content: `欢迎使用 DWS Insight！\n\n${workflowPrompts[currentWorkflow as keyof typeof workflowPrompts]}`,
      }])
    }
  }, [currentWorkflow])

  const handleSend = useCallback(async (input: string) => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

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
    const response = await window.electronAPI?.llmChat({
      messages: [
        { role: 'system', content: '你是一个 SQL 调优专家。用户会输入 SQL 语句，你需要分析并给出优化建议。' },
        { role: 'user', content: input }
      ]
    })

    if (response.success) {
      updateMessage(thinkingId, {
        type: 'assistant',
        content: response.content || '分析完成',
        think: response.think,
      })
    } else {
      updateMessage(thinkingId, {
        type: 'error',
        content: response.error || '调优分析失败',
      })
    }
  }

  const handleReportWorkflow = async (input: string, thinkingId: string) => {
    updateMessage(thinkingId, {
      type: 'thinking',
      content: '正在创建测试报告...',
    })

    const reportResponse = await window.electronAPI?.reportCreate('测试报告 ' + new Date().toLocaleString(), input)
    if (!reportResponse?.success || !reportResponse.data) {
      updateMessage(thinkingId, {
        type: 'error',
        content: reportResponse?.error || '创建报告失败',
      })
      return
    }
    const reportId = reportResponse.data.id as number

    updateMessage(thinkingId, {
      type: 'thinking',
      content: '正在解析测试需求，生成测试用例...',
    })

    const parseResponse = await window.electronAPI?.testRunnerParseRequirements(input)
    if (!parseResponse?.success || !parseResponse.testCase) {
      updateMessage(thinkingId, {
        type: 'error',
        content: parseResponse?.error || '解析需求失败',
      })
      return
    }

    const testCase = parseResponse.testCase

    updateMessage(thinkingId, {
      type: 'thinking',
      content: `正在执行测试用例: ${testCase.name}...`,
    })

    const executeResponse = await window.electronAPI?.testRunnerExecute(testCase, reportId)
    if (!executeResponse?.success) {
      updateMessage(thinkingId, {
        type: 'error',
        content: executeResponse?.error || '执行测试用例失败',
      })
      return
    }

    const executedCase = executeResponse.executedCase

    let resultContent = `# 测试报告\n\n`
    resultContent += `## ${executedCase.name}\n\n`
    resultContent += `**前置条件:** ${executedCase.preconditions}\n\n`
    resultContent += `**预期结果:** ${executedCase.expected_results}\n\n`
    resultContent += `## 测试步骤\n\n`

    for (const step of executedCase.steps) {
      const statusIcon = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⏳'
      resultContent += `### ${statusIcon} ${step.step}\n\n`
      if (step.sql) {
        resultContent += `**SQL:** \`\`\`sql\n${step.sql}\n\`\`\`\n\n`
      }
      if (step.expected) {
        resultContent += `**预期:** ${step.expected}\n\n`
      }
      if (step.actual) {
        resultContent += `**实际结果:**\n\`\`\`\n${step.actual}\n\`\`\`\n\n`
      }
      if (step.error) {
        resultContent += `**错误:** ${step.error}\n\n`
      }
    }

    resultContent += `---\n\n`
    resultContent += `**总体状态:** ${executedCase.status === 'passed' ? '✅ 通过' : '❌ 失败'}\n`

    updateMessage(thinkingId, {
      type: 'result',
      content: resultContent,
    })
  }

  const handleChatWorkflow = async (input: string, thinkingId: string) => {
    const response = await window.electronAPI?.llmChat({
      messages: [
        { role: 'user', content: input }
      ]
    })

    if (response.success) {
      updateMessage(thinkingId, {
        type: 'assistant',
        content: response.content || '收到',
        think: response.think,
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
      <Layout style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', flexDirection: 'column' }}>
        <Content style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
          {/* Header bar - rounded gray container */}
          <Header
            currentWorkflow={currentWorkflow}
            onWorkflowChange={setCurrentWorkflow}
            currentCluster={currentCluster}
            onClusterChange={setCurrentCluster}
            modelConfig={modelConfig}
            onModelChange={setModelConfig}
          />

          {/* Chat area - rounded white container */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: 12,
            overflow: 'hidden',
            flex: 1,
            minHeight: 200,
            padding: '12px 16px',
          }}>
            <ChatContainer messages={messages} />
            <InputArea
              onSend={handleSend}
              onStop={handleStop}
              loading={loading}
            />
          </div>
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
