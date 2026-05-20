import { useState, useEffect } from 'react'
import { Form, Input, InputNumber, Button, Space, message, Popconfirm, Divider } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { Cluster } from './ClusterSelector'

interface ClusterFormData {
  id?: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
}

interface Props {
  visible: boolean
  editingCluster: Cluster | null
  onClose: () => void
  onSave: (cluster: Omit<Cluster, 'id'>) => void
  onDelete?: (id: string) => void
}

export default function ClusterModal({ visible, editingCluster, onClose, onSave, onDelete }: Props) {
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (visible) {
      if (editingCluster) {
        form.setFieldsValue({
          name: editingCluster.name,
          host: editingCluster.host,
          port: editingCluster.port,
          database: editingCluster.database,
          username: editingCluster.username,
          password: (editingCluster as any).password || '',
        })
      } else {
        form.setFieldsValue({
          name: '',
          host: '',
          port: 8000,
          database: 'postgres',
          username: '',
          password: '',
        })
      }
      setTestResult(null)
    }
  }, [visible, editingCluster])

  const handleTestConnection = async () => {
    const values = form.getFieldsValue()
    if (!values.host || !values.port || !values.database || !values.username) {
      message.warning('请填写完整的连接信息')
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const response = await window.electronAPI?.testCluster({
        host: values.host,
        port: values.port,
        database: values.database,
        user: values.username,
        password: values.password || '',
      })
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
        host: values.host,
        port: values.port,
        database: values.database,
        username: values.username,
      })
      onClose()
    })
  }

  const handleDelete = () => {
    if (editingCluster?.id && onDelete) {
      onDelete(editingCluster.id)
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
            {editingCluster ? '编辑集群' : '新建集群'}
          </div>
          <Button type="text" size="small" onClick={onClose} style={{ color: '#64748b' }}>✕</Button>
        </div>

        {/* Form Content */}
        <div style={{ padding: 20, flex: 1, overflow: 'auto' }}>
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="集群名称" rules={[{ required: true, message: '请输入集群名称' }]}>
              <Input placeholder="例如: 测试集群" disabled={!!editingCluster} />
            </Form.Item>

            <Form.Item name="host" label="主机地址" rules={[{ required: true, message: '请输入主机地址' }]}>
              <Input placeholder="192.168.1.100" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={65535} />
              </Form.Item>
              <Form.Item name="database" label="数据库名" rules={[{ required: true, message: '请输入数据库名' }]}>
                <Input placeholder="postgres" />
              </Form.Item>
            </div>

            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="用户名" />
            </Form.Item>

            <Form.Item name="password" label="密码">
              <Input.Password placeholder="密码" />
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
            {editingCluster && onDelete && (
              <Popconfirm
                title="确定删除此集群?"
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
