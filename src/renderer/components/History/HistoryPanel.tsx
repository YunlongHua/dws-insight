import { Card, Empty } from 'antd'

export default function HistoryPanel() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#1e293b' }}>历史记录</h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>查看历史操作和执行记录</p>
      </div>

      <Card style={{ borderRadius: 12, minHeight: 300 }}>
        <Empty
          description="暂无历史记录"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    </div>
  )
}
