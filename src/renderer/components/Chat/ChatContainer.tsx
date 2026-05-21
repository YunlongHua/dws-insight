import { useEffect, useRef } from 'react'
import MessageBubble, { MessageType } from './MessageBubble'

export interface Message {
  id: string
  type: MessageType
  content: string
  think?: string
  timestamp: Date
  toolName?: string
  toolCommand?: string
  status?: 'running' | 'success' | 'error'
  showToolExecutions?: boolean
  toolExecutionsCount?: number
}

interface Props {
  messages: Message[]
  onShowToolExecutions?: () => void
}

export default function ChatContainer({ messages, onShowToolExecutions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div
      ref={containerRef}
      className="chat-container"
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          type={message.type}
          content={message.content}
          think={message.think}
          timestamp={message.timestamp}
          toolName={message.toolName}
          toolCommand={message.toolCommand}
          status={message.status}
          showToolExecutions={message.showToolExecutions}
          toolExecutionsCount={message.toolExecutionsCount}
          onShowToolExecutions={onShowToolExecutions}
        />
      ))}
    </div>
  )
}
