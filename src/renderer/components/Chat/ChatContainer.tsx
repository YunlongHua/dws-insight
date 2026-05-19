import { useEffect, useRef } from 'react'
import MessageBubble, { MessageType } from './MessageBubble'

export interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: Date
}

interface Props {
  messages: Message[]
}

export default function ChatContainer({ messages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        background: '#f8fafc',
      }}
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          type={message.type}
          content={message.content}
          timestamp={message.timestamp}
        />
      ))}
    </div>
  )
}
