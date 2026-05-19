import { useState, useEffect } from 'react'
import { Card, Form, Select, Input, Button, message, Divider, Tag } from 'antd'

interface LLMConfig {
  provider: 'openai' | 'eimaas' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

const providerOptions = [
  { value: 'openai', label: 'OpenAI 兼容 API' },
  { value: 'eimaas', label: '华为云 EI-MaaS' },
  { value: 'custom', label: '自建模型' },
]

const modelOptions = {
  openai: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  eimaas: [
    { value: 'default', label: '默认模型' },
  ],
  custom: [
    { value: 'default', label: '默认模型' },
  ],
}

export default function LLMPanel() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState<'openai' | 'eimaas' | 'custom'>('openai')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await window.electronAPI.llmGetConfig()
      if (response.success && response.data) {
        const config = response.data as LLMConfig
        form.setFieldsValue(config)
        setProvider(config.provider || 'openai')
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const handleSave = async (values: LLMConfig) => {
    setLoading(true)
    try {
      const response = await window.electronAPI.llmSetConfig(values)
      if (response.success) {
        message.success('配置保存成功')
      } else {
        message.error(response.error || '保存失败')
      }
    } catch (error: any) {
      message.error(error.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = (value: 'openai' | 'eimaas' | 'custom') => {
    setProvider(value)
    form.setFieldValue('model', '')
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#1e293b' }}>大模型配置</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>配置 LLM 提供者以启用 AI 功能</p>
      </div>

      <Card style={{ borderRadius: 12, maxWidth: 600 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ provider: 'openai', model: 'gpt-4' }}
        >
          <Form.Item
            name="provider"
            label="模型提供者"
            rules={[{ required: true, message: '请选择模型提供者' }]}
          >
            <Select
              options={providerOptions}
              onChange={handleProviderChange}
              placeholder="选择 LLM 提供者"
            />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>

          <Form.Item
            name="baseUrl"
            label="API 地址"
            tooltip={provider === 'openai' ? '留空使用 OpenAI 默认地址' : '输入 API 服务器地址'}
          >
            <Input
              placeholder={
                provider === 'openai'
                  ? 'https://api.openai.com/v1 (留空使用默认)'
                  : '输入 API 服务器地址'
              }
            />
          </Form.Item>

          <Form.Item
            name="model"
            label="模型名称"
            tooltip="输入模型名称，如 gpt-4"
          >
            <Select
              placeholder="选择或输入模型"
              allowClear
              showSearch
              options={provider === 'openai' ? modelOptions.openai : modelOptions.eimaas}
              onChange={(value) => {
                if (!value && provider === 'openai') {
                  form.setFieldValue('model', 'gpt-4')
                }
              }}
            />
          </Form.Item>

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存配置
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>提示</h4>
          <ul style={{ fontSize: 12, color: '#64748b', margin: 0, paddingLeft: 20 }}>
            <li>OpenAI: 使用 OpenAI 官方 API 或兼容的第三方服务</li>
            <li>华为云 EI-MaaS: 使用华为云企业级大模型服务</li>
            <li>自建模型: 连接您私有部署的模型服务</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
