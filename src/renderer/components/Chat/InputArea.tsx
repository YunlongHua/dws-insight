import { useState } from 'react'
import { Button, Input } from 'antd'
import { SendOutlined, StopOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface Props {
  onSend: (message: string) => void
  onStop?: () => void
  disabled?: boolean
  loading?: boolean
}

export default function InputArea({ onSend, onStop, disabled, loading }: Props) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    if (value.trim() && !loading) {
      onSend(value.trim())
      setValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      padding: '12px 16px 0',
      background: '#fff',
      borderTop: '1px solid #f0f0f0',
    }}>
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-end',
      }}>
        <TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入指令或 SQL... (Shift+Enter 换行)"
          disabled={disabled}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{
            flex: 1,
            borderRadius: 10,
            resize: 'none',
            fontSize: 14,
            padding: '10px 14px',
            border: '1px solid #e8e8e8',
          }}
        />
        <Button
          type="primary"
          icon={loading ? <StopOutlined /> : <SendOutlined />}
          onClick={loading ? onStop : handleSend}
          disabled={!loading && !value.trim()}
          loading={loading}
          style={{
            height: 42,
            width: 42,
            padding: 0,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        />
      </div>
    </div>
  )
}
