import { useState, useEffect } from 'react'
import { Select, Button, Modal, Form, Input, InputNumber, message, Popconfirm, Space } from 'antd'

interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
}

interface Props {
  value?: Cluster
  onChange: (cluster: Cluster | undefined) => void
}

export default function ClusterSelector({ value, onChange }: Props) {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadClusters()
  }, [])

  const loadClusters = async () => {
    try {
      const list = await window.electronAPI?.getClusters()
      setClusters(list || [])
    } catch (error) {
      console.error('Failed to load clusters:', error)
    }
  }

  const handleSave = async (values: Partial<Cluster>) => {
    try {
      await window.electronAPI?.addCluster(values as Omit<Cluster, 'id'>)
      message.success('集群添加成功')
      setModalVisible(false)
      form.resetFields()
      loadClusters()
    } catch (error) {
      message.error('添加失败')
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Select
          value={value?.id}
          onChange={(id) => {
            const cluster = clusters.find(c => c.id === id)
            onChange(cluster)
          }}
          placeholder="选择集群"
          style={{ width: 180 }}
          options={clusters.map(c => ({ value: c.id, label: c.name }))}
          dropdownRender={(menu) => (
            <>
              {menu}
              <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0' }}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => setModalVisible(true)}
                  style={{ padding: 0, height: 'auto' }}
                >
                  + 添加集群
                </Button>
              </div>
            </>
          )}
        />
      </div>

      <Modal
        title="添加集群"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="集群名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 测试集群" />
          </Form.Item>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]}>
            <Input placeholder="192.168.1.100" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="port" label="端口" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} max={65535} defaultValue={5432} />
            </Form.Item>
            <Form.Item name="database" label="数据库名" rules={[{ required: true }]}>
              <Input placeholder="postgres" />
            </Form.Item>
          </div>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">添加</Button>
          </div>
        </Form>
      </Modal>
    </>
  )
}
