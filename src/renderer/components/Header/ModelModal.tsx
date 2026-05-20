import { useState, useEffect } from 'react'
import { Form, Input, Select, Button, Space, message, Popconfirm, Divider, Tooltip } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons'

export interface LLMConfig {
  id?: string
  name: string
  provider: 'openai' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

interface Props {
  visible: boolean
  editingModel: LLMConfig | null
  onClose: () => void
  onSave: (model: Omit<LLMConfig, 'id'>) => void
  onDelete?: (id: string) => void
}

const providerOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: '自定义' },
]

const modelOptions: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  custom: [
    { value: 'custom', label: '自定义模型' },
  ],
}

export default function ModelModal({ visible, editingModel, onClose, onSave, onDelete }: Props) {
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('openai')

  useEffect(() => {
    if (visible) {
      if (editingModel) {
        form.setFieldsValue({
          name: editingModel.name,
          provider: editingModel.provider,
          apiKey: editingModel.apiKey,
          baseUrl: editingModel.baseUrl,
          model: editingModel.model,
        })
        setSelectedProvider(editingModel.provider)
      } else {
        form.setFieldsValue({
          name: '',
          provider: 'openai',
          apiKey: '',
          baseUrl: '',
          model: 'gpt-4',
        })
        setSelectedProvider('openai')
      }
      setTestResult(null)
    }
  }, [visible, editingModel])

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    if (provider === 'custom') {
      form.setFieldValue('model', '')
    } else {
      form.setFieldValue('model', 'gpt-4')
    }
  }

  const handleTestConnection = async () => {
    const values = form.getFieldsValue()
    if (!values.baseUrl) {
      message.warning('请输入 API 地址')
      return
    }
    if (!values.model) {
      message.warning('请选择或输入模型')
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const testConfig = {
        provider: values.provider,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        model: values.model,
      }
      const response = await window.electronAPI?.llmTestConnection(testConfig)
      if (response?.success) {
        setTestResult({ success: true, message: '连接成功' })
        message.success('连接成功')
      } else {
        setTestResult({ success: false, message: response?.error || '连接失败' })
        message.error(response?.error || '连接失败')
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message })
      message.error(err.message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (!testResult?.success) {
        message.warning('请先测试连接')
        return
      }
      onSave({
        name: values.name,
        provider: values.provider,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        model: values.model,
      })
      onClose()
    })
  }

  const handleDelete = () => {
    if (editingModel?.id && onDelete) {
      onDelete(editingModel.id)
      onClose()
    }
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        width: 480,
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
            {editingModel ? '编辑模型配置' : '新建模型配置'}
          </div>
          <Button type="text" size="small" onClick={onClose} style={{ color: '#64748b' }}>✕</Button>
        </div>

        {/* Form Content */}
        <div style={{ padding: 20, flex: 1, overflow: 'auto' }}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="配置名称"
              rules={[{ required: true, message: '请输入配置名称' }]}
              tooltip="用于识别此配置的名称"
            >
              <Input placeholder="例如: 我的GPT-4" disabled={!!editingModel} />
            </Form.Item>

            <Form.Item name="provider" label="模型提供者" rules={[{ required: true }]}>
              <Select options={providerOptions} onChange={handleProviderChange} />
            </Form.Item>

            <Form.Item
              name="apiKey"
              label="API Key"
              tooltip={{ title: '自定义模型必填，OpenAI 可留空', icon: <QuestionCircleOutlined /> }}
            >
              <Input.Password placeholder="输入 API Key（可选）" />
            </Form.Item>

            <Form.Item
              name="baseUrl"
              label="API 地址"
              rules={[{ required: true, message: '请输入 API 地址' }]}
              tooltip={{ title: 'OpenAI 默认: https://api.openai.com/v1', icon: <QuestionCircleOutlined /> }}
            >
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.provider !== curr.provider}>
              {({ getFieldValue }) => {
                const provider = getFieldValue('provider') || selectedProvider
                if (provider === 'custom') {
                  return (
                    <Form.Item
                      name="model"
                      label="模型名称"
                      rules={[{ required: true, message: '请输入模型名称' }]}
                    >
                      <Input placeholder="输入自定义模型名称，如 qwen-max" />
                    </Form.Item>
                  )
                }
                return (
                  <Form.Item
                    name="model"
                    label="模型"
                    rules={[{ required: true, message: '请选择模型' }]}
                  >
                    <Select options={modelOptions[provider] || modelOptions.openai} placeholder="选择模型" />
                  </Form.Item>
                )
              }}
            </Form.Item>

            <Divider style={{ margin: '16px 0' }} />

            {/* Test Connection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button onClick={handleTestConnection} loading={testing}>
                测试连接
              </Button>
              {testResult && (
                <span style={{
                  color: testResult.success ? '#52c41a' : '#ff4d4f',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  {testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  {testResult.message}
                </span>
              )}
            </div>
          </Form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fafafa'
        }}>
          <div>
            {editingModel && onDelete && (
              <Popconfirm
                title="确定删除此模型配置?"
                onConfirm={handleDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button danger size="small">删除</Button>
              </Popconfirm>
            )}
          </div>
          <Space>
            <Button onClick={onClose} size="small">取消</Button>
            <Button type="primary" onClick={handleSave} size="small">保存</Button>
          </Space>
        </div>
      </div>
    </div>
  )
}
