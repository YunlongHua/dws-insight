import { useState, useEffect } from 'react'
import { Select, Button, message } from 'antd'
import { PlusOutlined, SettingOutlined, CheckCircleFilled, CloseCircleFilled, SyncOutlined } from '@ant-design/icons'
import ModelModal, { LLMConfig } from './ModelModal'

interface Props {
  value?: LLMConfig
  onChange: (config: LLMConfig | undefined) => void
  onConnectionStatusChange?: (connected: boolean) => void
}

export default function ModelSelector({ value, onChange, onConnectionStatusChange }: Props) {
  const [models, setModels] = useState<LLMConfig[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingModel, setEditingModel] = useState<LLMConfig | null>(null)
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    onConnectionStatusChange?.(connected === true)
  }, [connected])

  const loadModels = async () => {
    try {
      const response = await window.electronAPI?.llmGetAll()
      if (response?.success) {
        setModels(response.data || [])
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const handleAdd = () => {
    setEditingModel(null)
    setModalVisible(true)
  }

  const handleEdit = () => {
    if (value) {
      setEditingModel(value)
      setModalVisible(true)
    }
  }

  const handleSave = async (modelData: Omit<LLMConfig, 'id'>) => {
    try {
      if (editingModel?.id) {
        const response = await window.electronAPI?.llmUpdate(editingModel.id, modelData)
        if (response?.success) {
          message.success('模型配置已更新')
        }
      } else {
        const response = await window.electronAPI?.llmAdd(modelData)
        if (response?.success) {
          message.success('模型配置已添加')
          if (models.length === 0 && response.data) {
            await window.electronAPI?.llmSetCurrent(response.data.id)
            setConnected(true)
            onChange(response.data)
          }
        }
      }
      loadModels()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await window.electronAPI?.llmDelete(id)
      if (response?.success) {
        message.success('模型配置已删除')
        if (value?.id === id) {
          onChange(undefined)
          setConnected(false)
        }
        loadModels()
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleModelChange = async (modelId: string) => {
    try {
      setTesting(true)
      setConnected(null)

      const response = await window.electronAPI?.llmSetCurrent(modelId)
      if (response?.success) {
        const currentResponse = await window.electronAPI?.llmGetCurrent()
        if (currentResponse?.data) {
          setConnected(true)
          onChange(currentResponse.data)
        }
      } else {
        onChange(undefined)
        setConnected(false)
      }
    } catch (error: any) {
      onChange(undefined)
      setConnected(false)
      message.error(error.message || '切换失败')
    } finally {
      setTesting(false)
    }
  }

  const modelOptions = models.map(m => ({
    value: m.id!,
    label: `${m.name}`,
  }))

  const displayValue = value?.name || '选择模型'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>模型</span>

        {testing ? (
          <SyncOutlined spin style={{ color: '#4f8cff', fontSize: 12 }} />
        ) : connected === true ? (
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 12 }} />
        ) : connected === false ? (
          <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 12 }} />
        ) : null}

        <Select
          value={value?.id}
          onChange={handleModelChange}
          placeholder="选择模型"
          style={{ width: 160 }}
          options={modelOptions}
          size="small"
          popupMatchSelectWidth={false}
        />

        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          style={{ borderRadius: 6, height: 26 }}
        />
        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={handleEdit}
          disabled={!value}
          style={{ borderRadius: 6, height: 26 }}
        />
      </div>

      <ModelModal
        visible={modalVisible}
        editingModel={editingModel}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
