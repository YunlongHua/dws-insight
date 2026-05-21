import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { UserOutlined, RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, DownOutlined, UpOutlined, ToolOutlined, SyncOutlined, RightOutlined } from '@ant-design/icons'
import { Badge } from 'antd'
import type { ReactNode } from 'react'

export type MessageType = 'user' | 'assistant' | 'system' | 'result' | 'error' | 'thinking' | 'tool'

interface Props {
  type: MessageType
  content: string | ReactNode
  think?: string
  timestamp?: Date
  toolName?: string
  toolCommand?: string
  status?: 'running' | 'success' | 'error'
  showToolExecutions?: boolean
  toolExecutionsCount?: number
  onShowToolExecutions?: () => void
}

// Get display name for tool
function getToolDisplayName(toolName: string): string {
  const toolNames: Record<string, string> = {
    getclusterinfo: '获取集群信息',
    getschema: '获取表结构',
    executesql: '执行 SQL',
    getplan: '获取执行计划',
    getstats: '获取统计信息',
  }
  return toolNames[toolName?.toLowerCase()] || toolName || '工具'
}

// Parse think tags from content string
function parseThinkFromContent(content: string): { think: string | null; rest: string } {
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
  if (thinkMatch) {
    return {
      think: thinkMatch[1].trim(),
      rest: content.replace(/<think>[\s\S]*?<\/think>/, '').trim()
    }
  }
  return { think: null, rest: content }
}

const typeStyles: Record<MessageType, { bg: string; color: string; align: 'left' | 'right'; icon: ReactNode }> = {
  user: {
    bg: '#3b82f6',
    color: '#fff',
    align: 'right',
    icon: <UserOutlined />
  },
  assistant: {
    bg: '#f8fafc',
    color: '#1e293b',
    align: 'left',
    icon: <RobotOutlined />
  },
  system: {
    bg: '#fef3c7',
    color: '#92400e',
    align: 'left',
    icon: <CheckCircleOutlined />
  },
  result: {
    bg: '#ecfdf5',
    color: '#065f46',
    align: 'left',
    icon: <CheckCircleOutlined />
  },
  error: {
    bg: '#fef2f2',
    color: '#991b1b',
    align: 'left',
    icon: <CloseCircleOutlined />
  },
  thinking: {
    bg: '#f1f5f9',
    color: '#475569',
    align: 'left',
    icon: <LoadingOutlined spin />
  },
  tool: {
    bg: '#f0f9ff',
    color: '#0369a1',
    align: 'left',
    icon: <ToolOutlined />
  },
}

export default function MessageBubble({ type, content, think: thinkProp, timestamp, toolName, toolCommand, status, showToolExecutions, toolExecutionsCount, onShowToolExecutions }: Props) {
  const style = typeStyles[type]
  const isUser = type === 'user'
  const isTool = type === 'tool'
  const isRunning = status === 'running'

  // First check think prop, then parse from content string
  const contentStr = typeof content === 'string' ? content : ''
  const { think: parsedThink, rest: parsedRest } = contentStr ? parseThinkFromContent(contentStr) : { think: null, rest: content }
  const think = thinkProp || parsedThink
  const displayContent = thinkProp ? content : parsedRest

  const [thinkCollapsed, setThinkCollapsed] = useState(true)
  const [resultCollapsed, setResultCollapsed] = useState(true)

  // Get status icon
  const getStatusIcon = () => {
    if (isRunning) return <SyncOutlined spin style={{ color: '#0369a1' }} />
    if (status === 'error') return <CloseCircleOutlined style={{ color: '#ef4444' }} />
    return <CheckCircleOutlined style={{ color: '#22c55e' }} />
  }

  // Get display text for tool
  const getToolDisplayText = () => {
    if (isRunning) {
      return `⚙️ 正在${getToolDisplayName(toolName || '')}...`
    }
    return getToolDisplayName(toolName || '')
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: style.align === 'right' ? 'flex-end' : 'flex-start',
      marginBottom: 16,
    }}>
      <div style={{
        maxWidth: '70%',
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        {/* Avatar */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: isUser ? '#3b82f6' : '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isUser ? '#fff' : '#64748b',
          fontSize: 16,
          flexShrink: 0,
        }}>
          {style.icon}
        </div>

        {/* Message Content */}
        <div style={{
          background: style.bg,
          color: style.color,
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}>
          {/* Think section - collapsible */}
          {think && (
            <div style={{ marginBottom: displayContent ? 8 : 0 }}>
              <div
                onClick={() => setThinkCollapsed(!thinkCollapsed)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: 12,
                  userSelect: 'none',
                }}
              >
                {thinkCollapsed ? <UpOutlined /> : <DownOutlined />}
                <span>思考过程</span>
              </div>
              {!thinkCollapsed && (
                <pre style={{
                  margin: '8px 0 0 0',
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'Inter', 'Microsoft YaHei', sans-serif",
                  fontSize: 13,
                  color: '#64748b',
                  background: '#f1f5f9',
                  padding: 8,
                  borderRadius: 6,
                }}>
                  {think}
                </pre>
              )}
            </div>
          )}
          {/* Main content - hidden for tool type when collapsed */}
          {displayContent && !isTool && (typeof displayContent === 'string' ? (
            <div className="markdown-content" style={{
              margin: 0,
              fontFamily: "'Inter', 'Microsoft YaHei', sans-serif",
              fontSize: 14,
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
            </div>
          ) : (
            displayContent
          ))}

          {/* Tool execution content - collapsible */}
          {isTool && toolName && (
            <div style={{ marginTop: 12 }}>
              {/* Tool header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: isRunning ? '#fef3c7' : '#e0f2fe',
                borderRadius: 6,
                cursor: 'pointer',
              }} onClick={() => setResultCollapsed(!resultCollapsed)}>
                {getStatusIcon()}
                <span style={{ fontWeight: 600, color: isRunning ? '#92400e' : '#0369a1' }}>{getToolDisplayText()}</span>
                <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>
                  {resultCollapsed ? '点击展开' : '点击折叠'}
                </span>
                {resultCollapsed ? <DownOutlined style={{ color: '#94a3b8' }} /> : <UpOutlined style={{ color: '#94a3b8' }} />}
              </div>

              {/* Tool command */}
              {!resultCollapsed && toolCommand && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>执行命令:</div>
                  <pre style={{
                    margin: 0,
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    border: '1px solid #e2e8f0',
                  }}>
                    {toolCommand}
                  </pre>
                </div>
              )}

              {/* Tool result */}
              {!resultCollapsed && displayContent && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>执行结果:</div>
                  <pre style={{
                    margin: 0,
                    padding: '8px 12px',
                    background: '#f0fdf4',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflow: 'auto',
                    border: '1px solid #bbf7d0',
                  }}>
                    {typeof displayContent === 'string' ? displayContent : JSON.stringify(displayContent, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Tool executions button for user messages */}
          {isUser && showToolExecutions && toolExecutionsCount !== undefined && toolExecutionsCount > 0 && (
            <div style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.2)',
            }}>
              <div
                onClick={onShowToolExecutions}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                <ToolOutlined style={{ fontSize: 11 }} />
                <span>调用过程 ({toolExecutionsCount})</span>
                <RightOutlined style={{ fontSize: 10 }} />
              </div>
            </div>
          )}

          {timestamp && (
            <div style={{
              fontSize: 11,
              color: type === 'user' ? 'rgba(255,255,255,0.7)' : '#94a3b8',
              marginTop: 4,
              textAlign: isUser ? 'right' : 'left',
            }}>
              {timestamp.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
