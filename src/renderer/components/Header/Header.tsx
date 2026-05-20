import { Select } from 'antd'
import ClusterSelector from './ClusterSelector'
import ModelSelector from './ModelSelector'

interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
}

interface LLMConfig {
  id?: string
  name?: string
  provider: 'openai' | 'custom'
  apiKey?: string
  baseUrl?: string
  model?: string
}

interface Props {
  currentWorkflow: string
  onWorkflowChange: (workflow: string) => void
  currentCluster?: Cluster
  onClusterChange: (cluster: Cluster | undefined) => void
  modelConfig?: LLMConfig
  onModelChange: (config: LLMConfig | undefined) => void
}

const workflowOptions = [
  { value: 'tuning', label: 'DWS 调优' },
  { value: 'report', label: '测试报告' },
]

export default function Header({
  currentWorkflow,
  onWorkflowChange,
  currentCluster,
  onClusterChange,
  modelConfig,
  onModelChange
}: Props) {
  return (
    /* Top bar - rounded container */
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e8e8e8',
    }}>
      {/* Left side - Workflow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#999', whiteSpace: 'nowrap' }}>功能</span>
        <Select
          value={currentWorkflow}
          onChange={onWorkflowChange}
          options={workflowOptions}
          style={{ width: 130 }}
          popupMatchSelectWidth={false}
        />
      </div>

      {/* Right side - Cluster and Model */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ClusterSelector value={currentCluster} onChange={onClusterChange} />
        <ModelSelector value={modelConfig} onChange={onModelChange} />
      </div>
    </div>
  )
}
