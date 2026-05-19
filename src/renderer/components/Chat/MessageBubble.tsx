import { UserOutlined, RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Badge } from 'antd'
import type { ReactNode } from 'react'

export type MessageType = 'user' | 'assistant' | 'system' | 'result' | 'error' | 'thinking'

interface Props {
  type: MessageType
  content: string | ReactNode
  timestamp?: Date
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
}

export default function MessageBubble({ type, content, timestamp }: Props) {
  const style = typeStyles[type]
  const isUser = type === 'user'

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
          {typeof content === 'string' ? (
            <pre style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontFamily: "'Inter', 'Microsoft YaHei', sans-serif",
              fontSize: 14,
            }}>
              {content}
            </pre>
          ) : (
            content
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
