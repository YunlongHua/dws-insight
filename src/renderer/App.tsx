import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout, ConfigProvider, theme, message, Drawer, Tag } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, RightOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
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

interface ToolExecution {
  id: string
  toolName: string
  displayName: string
  command: string
  result: string
  status: 'running' | 'success' | 'error'
  startTime: number
  endTime?: number
  duration?: number
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
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([])
  const [showToolDrawer, setShowToolDrawer] = useState(false)
  const [collapsedTools, setCollapsedTools] = useState<Set<string>>(new Set())
  const currentUserMsgIdRef = useRef<string | null>(null)

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

    const userMsgId = `user-${Date.now()}`
    currentUserMsgIdRef.current = userMsgId

    const userMessage: Message = {
      id: userMsgId,
      type: 'user',
      content: input,
      timestamp: new Date(),
      showToolExecutions: false,
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
    if (!currentCluster?.id) {
      updateMessage(thinkingId, {
        type: 'error',
        content: '请先选择并连接集群',
      })
      return
    }

    // Clear previous tool executions
    setToolExecutions([])
    const currentUserMsgId = currentUserMsgIdRef.current

    // Tool display names
    const toolNames: Record<string, string> = {
      getclusterinfo: '获取集群信息',
      getschema: '获取表结构',
      executesql: '执行 SQL',
      getplan: '获取执行计划',
      getstats: '获取统计信息',
    }

    // Listen for progress updates
    const removeListener = window.electronAPI?.onTuningProgress?.((data) => {
      if (data.type === 'final') {
        // Final result - remove thinking message and add result at the end
        setMessages(prev => prev.filter(msg => msg.id !== thinkingId))
        if (data.error) {
          setMessages(prev => [...prev, {
            id: `result-${Date.now()}`,
            type: 'error',
            content: data.error,
            timestamp: new Date(),
          }])
        } else {
          setMessages(prev => [...prev, {
            id: `result-${Date.now()}`,
            type: 'result',
            content: data.content || '分析完成',
            think: data.think,
            timestamp: new Date(),
          }])
        }
        removeListener?.();
      } else if (data.type === 'tool_start') {
        // Add tool execution to state
        const toolMsgId = data.toolMsgId || `tool-${Date.now()}`
        const toolName = data.toolName || '工具'
        const displayName = toolNames[toolName?.toLowerCase()] || toolName
        const startTime = Date.now()
        setToolExecutions(prev => {
          const newExec = [...prev, {
            id: toolMsgId,
            toolName: toolName,
            displayName: displayName,
            command: data.toolCommand || '',
            result: '执行中...',
            status: 'running',
            startTime,
          }]
          // Update user message to show tool executions button
          if (currentUserMsgId) {
            setMessages(msgPrev => msgPrev.map(msg =>
              msg.id === currentUserMsgId
                ? { ...msg, showToolExecutions: true, toolExecutionsCount: newExec.length }
                : msg
            ))
          }
          return newExec
        })
      } else if (data.type === 'tool_result' || data.type === 'tool_error') {
        // Update the tool execution with duration
        const toolMsgId = data.toolMsgId
        setToolExecutions(prev => {
          if (toolMsgId) {
            const idx = prev.findIndex(t => t.id === toolMsgId)
            if (idx !== -1) {
              const updated = [...prev]
              const endTime = Date.now()
              const duration = endTime - updated[idx].startTime
              updated[idx] = {
                ...updated[idx],
                result: data.error || (typeof data.toolResult === 'string' ? data.toolResult : JSON.stringify(data.toolResult, null, 2)),
                status: data.error ? 'error' : 'success',
                endTime,
                duration,
              }
              return updated
            }
          }
          return prev
        })
      }
    });

    // Start workflow
    await window.electronAPI?.tuningWorkflow(currentCluster.id, input)
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

  const toggleToolCollapsed = (id: string) => {
    setCollapsedTools(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleStop = async () => {
    await window.electronAPI?.tuningStop()
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
            <ChatContainer
              messages={messages}
              onShowToolExecutions={() => setShowToolDrawer(true)}
            />
            <InputArea
              onSend={handleSend}
              onStop={handleStop}
              loading={loading}
            />
          </div>
        </Content>

        {/* Tool execution details drawer */}
        <Drawer
          title="调用过程详情"
          placement="right"
          width={500}
          open={showToolDrawer}
          onClose={() => setShowToolDrawer(false)}
          styles={{ body: { padding: '16px' } }}
        >
          {toolExecutions.map((exec) => {
            const isCollapsed = collapsedTools.has(exec.id)
            return (
              <div key={exec.id} style={{
                marginBottom: 16,
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                overflow: 'hidden'
              }}>
                {/* Header - always visible, clickable */}
                <div
                  onClick={() => toggleToolCollapsed(exec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    background: exec.status === 'success' ? '#f6ffed' : exec.status === 'error' ? '#fff2f0' : '#f0f5ff',
                    cursor: 'pointer',
                  }}
                >
                  {exec.status === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                   exec.status === 'error' ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> :
                   <SyncOutlined spin style={{ color: '#1890ff' }} />}
                  <span style={{ fontWeight: 500 }}>{exec.displayName}</span>
                  {exec.duration !== undefined && (
                    <Tag color="default" style={{ marginLeft: 'auto' }}>{exec.duration}ms</Tag>
                  )}
                  {isCollapsed ? <DownOutlined style={{ marginLeft: 'auto' }} /> : <UpOutlined style={{ marginLeft: 'auto' }} />}
                </div>

                {/* Collapsible content */}
                {!isCollapsed && (
                  <div style={{ padding: 12 }}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>执行命令:</div>
                      <pre style={{
                        margin: 0,
                        padding: 8,
                        background: '#f5f5f5',
                        borderRadius: 4,
                        fontSize: 12,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        maxHeight: 150,
                        overflow: 'auto'
                      }}>
                        {exec.command}
                      </pre>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>执行结果:</div>
                      <pre style={{
                        margin: 0,
                        padding: 8,
                        background: exec.status === 'error' ? '#fff2f0' : '#f6ffed',
                        borderRadius: 4,
                        fontSize: 12,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        maxHeight: 200,
                        overflow: 'auto'
                      }}>
                        {exec.result}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </Drawer>
      </Layout>
    </ConfigProvider>
  )
}
