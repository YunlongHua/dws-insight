import { useState, useEffect } from 'react'
import { Card, Button, Space, Tag, message, Modal, Form, Input, InputNumber, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password?: string
}

export default function ClusterPanel() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null)
  const [form] = Form.useForm()
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const loadClusters = async () => {
    try {
      const list = await window.electronAPI?.getClusters()
      setClusters(list || [])
    } catch (error) {
      console.error('Failed to load clusters:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClusters()
  }, [])

  const handleAdd = () => {
    setEditingCluster(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (cluster: Cluster) => {
    setEditingCluster(cluster)
    form.setFieldsValue(cluster)
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI?.deleteCluster(id)
      message.success('删除成功')
      loadClusters()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleTest = async (cluster: Cluster) => {
    setTestingId(cluster.id)
    try {
      const result = await window.electronAPI?.testCluster(cluster)
      setTestResults(prev => ({ ...prev, [cluster.id]: result }))
      if (result.success) {
        message.success(`连接成功: ${result.message.substring(0, 50)}...`)
      } else {
        message.error(`连接失败: ${result.message}`)
      }
    } catch (error: any) {
      message.error(`测试失败: ${error.message}`)
    } finally {
      setTestingId(null)
    }
  }

  const handleSubmit = async (values: Partial<Cluster>) => {
    try {
      if (editingCluster) {
        await window.electronAPI?.updateCluster(editingCluster.id, values)
        message.success('更新成功')
      } else {
        await window.electronAPI?.addCluster(values as Omit<Cluster, 'id'>)
        message.success('添加成功')
      }
      setModalVisible(false)
      loadClusters()
    } catch (error) {
      message.error('操作失败')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#1e293b' }}>集群管理</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>管理 DWS 集群连接配置</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加集群
        </Button>
      </div>

      {clusters.length === 0 && !loading ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: '#64748b' }}>
            <p style={{ marginBottom: 16 }}>暂无集群配置</p>
            <Button type="primary" onClick={handleAdd}>添加第一个集群</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {clusters.map(cluster => (
            <Card
              key={cluster.id}
              size="small"
              style={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              styles={{ body: { padding: 16 } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#1e293b' }}>{cluster.name}</h4>
                  {testResults[cluster.id] && (
                    <Tag
                      color={testResults[cluster.id].success ? 'success' : 'error'}
                      style={{ marginTop: 6, borderRadius: 4 }}
                    >
                      {testResults[cluster.id].success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      {testResults[cluster.id].success ? ' 已连接' : ' 未连接'}
                    </Tag>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                <div style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, marginBottom: 8 }}>
                  {cluster.host}:{cluster.port}/{cluster.database}
                </div>
                <div>用户: {cluster.username}</div>
              </div>

              <Space>
                <Button
                  size="small"
                  loading={testingId === cluster.id}
                  onClick={() => handleTest(cluster)}
                >
                  测试连接
                </Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(cluster)}>
                  编辑
                </Button>
                <Popconfirm
                  title="确定删除该集群？"
                  onConfirm={() => handleDelete(cluster.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title={editingCluster ? '编辑集群' : '添加集群'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={480}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={editingCluster || { port: 5432, database: 'postgres' }}
        >
          <Form.Item
            name="name"
            label="集群名称"
            rules={[{ required: true, message: '请输入集群名称' }]}
          >
            <Input placeholder="例如: 测试集群" />
          </Form.Item>

          <Form.Item
            name="host"
            label="主机地址"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input placeholder="例如: 192.168.1.100" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="port"
              label="端口"
              rules={[{ required: true, message: '请输入端口' }]}
            >
              <InputNumber style={{ width: '100%' }} min={1} max={65535} />
            </Form.Item>

            <Form.Item
              name="database"
              label="数据库名"
              rules={[{ required: true, message: '请输入数据库名' }]}
            >
              <Input placeholder="例如: postgres" />
            </Form.Item>
          </div>

          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: !editingCluster, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingCluster ? '不修改请留空' : '请输入密码'} />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">
              {editingCluster ? '更新' : '添加'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
