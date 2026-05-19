import { Layout, Select } from 'antd'
import ClusterSelector from './ClusterSelector'
import ModelInfo from './ModelInfo'

const { Header: AntHeader } = Layout

interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
}

interface Props {
  currentWorkflow: string
  onWorkflowChange: (workflow: string) => void
  currentCluster?: Cluster
  onClusterChange: (cluster: Cluster | undefined) => void
}

const workflowOptions = [
  { value: 'tuning', label: 'DWS 调优' },
  { value: 'report', label: '测试报告' },
  { value: 'chat', label: '通用对话' },
]

export default function Header({
  currentWorkflow,
  onWorkflowChange,
  currentCluster,
  onClusterChange
}: Props) {
  return (
    <AntHeader style={{
      height: 64,
      padding: '0 24px',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Left side - Logo and Workflow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#1e293b',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#3b82f6" />
            <path d="M7 12h10M12 7v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          DWS Client
        </div>

        <Select
          value={currentWorkflow}
          onChange={onWorkflowChange}
          options={workflowOptions}
          style={{ width: 140 }}
          variant="borderless"
          styles={{
            popup: { root: { top: '100% !important' } }
          }}
        />
      </div>

      {/* Right side - Cluster and Model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ClusterSelector value={currentCluster} onChange={onClusterChange} />
        <ModelInfo />
      </div>
    </AntHeader>
  )
}
