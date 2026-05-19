import { useState, useEffect } from 'react'
import { Tag, Tooltip } from 'antd'
import { RobotOutlined } from '@ant-design/icons'

interface LLMConfig {
  provider: 'openai' | 'eimaas' | 'custom'
  baseUrl?: string
  model?: string
}

export default function ModelInfo() {
  const [config, setConfig] = useState<LLMConfig | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await window.electronAPI?.llmGetConfig()
      if (response.success && response.data) {
        setConfig(response.data as LLMConfig)
      }
    } catch (error) {
      console.error('Failed to load LLM config:', error)
    }
  }

  const providerLabels = {
    openai: 'OpenAI',
    eimaas: 'EI-MaaS',
    custom: '自定义'
  }

  return (
    <Tooltip title={config?.baseUrl || '未配置'}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 6,
        cursor: 'pointer'
      }}>
        <RobotOutlined style={{ color: '#3b82f6' }} />
        <span style={{ fontSize: 13, color: '#3b82f6' }}>
          {config?.model || '未配置'}
        </span>
        <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
          {config ? providerLabels[config.provider] : '未配置'}
        </Tag>
      </div>
    </Tooltip>
  )
}
