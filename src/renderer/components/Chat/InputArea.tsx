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
      padding: '16px 24px',
      background: '#fff',
      borderTop: '1px solid #e2e8f0',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-end',
    }}>
      <TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入指令或 SQL... (Shift+Enter 换行)"
        disabled={disabled || loading}
        autoSize={{ minRows: 1, maxRows: 4 }}
        style={{
          flex: 1,
          borderRadius: 12,
          resize: 'none',
        }}
      />
      <Button
        type="primary"
        icon={loading ? <StopOutlined /> : <SendOutlined />}
        onClick={loading ? onStop : handleSend}
        disabled={!loading && !value.trim()}
        loading={loading}
        style={{
          height: 40,
          width: 40,
          padding: 0,
          borderRadius: 10,
        }}
      />
    </div>
  )
}
