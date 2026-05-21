import { useState, useEffect } from 'react'
import { Select, Button, message } from 'antd'
import { PlusOutlined, SettingOutlined, CheckCircleFilled, CloseCircleFilled, SyncOutlined } from '@ant-design/icons'
import ClusterModal from './ClusterModal'

export interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password?: string
}

interface Props {
  value?: Cluster
  onChange: (cluster: Cluster | undefined) => void
  onConnectionStatusChange?: (connected: boolean) => void
}

export default function ClusterSelector({ value, onChange, onConnectionStatusChange }: Props) {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null)
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    loadClusters()
  }, [])

  useEffect(() => {
    onConnectionStatusChange?.(connected === true)
  }, [connected])

  const loadClusters = async () => {
    try {
      const list = await window.electronAPI?.getClusters()
      setClusters(list || [])
    } catch (error) {
      console.error('Failed to load clusters:', error)
    }
  }

  const handleAdd = () => {
    setEditingCluster(null)
    setModalVisible(true)
  }

  const handleEdit = () => {
    if (value) {
      setEditingCluster(value)
      setModalVisible(true)
    }
  }

  const handleSave = async (clusterData: Omit<Cluster, 'id'>) => {
    try {
      if (editingCluster) {
        await window.electronAPI?.updateCluster(editingCluster.id, clusterData)
        message.success('集群已更新')
      } else {
        await window.electronAPI?.addCluster(clusterData)
        message.success('集群已添加')
      }
      loadClusters()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI?.deleteCluster(id)
      message.success('集群已删除')
      if (value?.id === id) {
        onChange(undefined)
        setConnected(false)
      }
      loadClusters()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleClusterChange = async (clusterId: string) => {
    const cluster = clusters.find(c => c.id === clusterId)
    if (cluster) {
      setTesting(true)
      setConnected(null)
      onChange(cluster)
      try {
        const response = await window.electronAPI?.testClusterById(clusterId)
        if (response?.success) {
          setConnected(true)
        } else {
          setConnected(false)
          const errorMsg = response?.error || response?.message || '连接失败'
          message.error(`连接失败: ${errorMsg}`)
        }
      } catch (error: any) {
        setConnected(false)
        message.error(`连接失败: ${error.message || '网络错误'}`)
      } finally {
        setTesting(false)
      }
    }
  }

  const clusterOptions = clusters.map(c => ({
    value: c.id,
    label: c.name,
  }))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>集群</span>

        {testing ? (
          <SyncOutlined spin style={{ color: '#4f8cff', fontSize: 12 }} />
        ) : connected === true ? (
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 12 }} />
        ) : connected === false ? (
          <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 12 }} />
        ) : null}

        <Select
          value={value?.id}
          onChange={handleClusterChange}
          placeholder="选择集群"
          style={{ width: 140 }}
          options={clusterOptions}
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

      <ClusterModal
        visible={modalVisible}
        editingCluster={editingCluster}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
