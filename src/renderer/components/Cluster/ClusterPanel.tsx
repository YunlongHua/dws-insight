import React, { useState, useEffect } from 'react';
import ClusterForm from './ClusterForm';

interface Cluster {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
}

interface ClusterPanelProps {
  activeView?: string;
}

function ClusterPanel({ activeView }: ClusterPanelProps): React.ReactElement {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [key: string]: { success: boolean; message: string } }>({});

  const loadClusters = async () => {
    try {
      const clusterList = await window.electronAPI?.getClusters();
      setClusters(clusterList || []);
    } catch (error) {
      console.error('Failed to load clusters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleAddCluster = () => {
    setEditingCluster(null);
    setShowForm(true);
  };

  const handleEditCluster = (cluster: Cluster) => {
    setEditingCluster(cluster);
    setShowForm(true);
  };

  const handleDeleteCluster = async (id: string) => {
    if (!confirm('确定要删除这个集群吗？')) return;
    try {
      await window.electronAPI?.deleteCluster(id);
      await loadClusters();
    } catch (error) {
      console.error('Failed to delete cluster:', error);
    }
  };

  const handleTestConnection = async (cluster: Cluster) => {
    setTestingId(cluster.id);
    try {
      const result = await window.electronAPI?.testCluster(cluster);
      setTestResult((prev) => ({ ...prev, [cluster.id]: result }));
    } catch (error: any) {
      setTestResult((prev) => ({
        ...prev,
        [cluster.id]: { success: false, message: error.message }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleFormSave = async (clusterData: Omit<Cluster, 'id'>) => {
    try {
      if (editingCluster) {
        await window.electronAPI?.updateCluster(editingCluster.id, clusterData);
      } else {
        await window.electronAPI?.addCluster(clusterData);
      }
      setShowForm(false);
      setEditingCluster(null);
      await loadClusters();
    } catch (error) {
      console.error('Failed to save cluster:', error);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingCluster(null);
  };

  if (loading) {
    return (
      <div className="cluster-panel">
        <div className="cluster-loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="cluster-panel">
      <div className="cluster-header">
        <h2>集群管理</h2>
        <button className="btn btn-primary" onClick={handleAddCluster}>
          + 添加集群
        </button>
      </div>

      {clusters.length === 0 ? (
        <div className="cluster-empty">
          <p>暂无集群配置</p>
          <button className="btn btn-primary" onClick={handleAddCluster}>
            添加第一个集群
          </button>
        </div>
      ) : (
        <div className="cluster-list">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="cluster-card">
              <div className="cluster-card-header">
                <h3>{cluster.name}</h3>
                <span className="cluster-status">
                  {testResult[cluster.id] && (
                    <span className={testResult[cluster.id].success ? 'status-success' : 'status-error'}>
                      {testResult[cluster.id].success ? '已连接' : '未连接'}
                    </span>
                  )}
                </span>
              </div>
              <div className="cluster-card-body">
                <p className="cluster-info">
                  <span className="cluster-label">地址:</span>
                  <span className="cluster-value">{cluster.host}:{cluster.port}/{cluster.database}</span>
                </p>
                <p className="cluster-info">
                  <span className="cluster-label">用户:</span>
                  <span className="cluster-value">{cluster.username}</span>
                </p>
              </div>
              <div className="cluster-card-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTestConnection(cluster)}
                  disabled={testingId === cluster.id}
                >
                  {testingId === cluster.id ? '测试中...' : '测试连接'}
                </button>
                <button className="btn btn-secondary" onClick={() => handleEditCluster(cluster)}>
                  编辑
                </button>
                <button className="btn btn-secondary" onClick={() => handleDeleteCluster(cluster.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ClusterForm
          cluster={editingCluster}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}

      <style>{`
        .cluster-panel {
          padding: 0;
        }
        .cluster-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .cluster-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text);
        }
        .cluster-loading {
          text-align: center;
          padding: 40px;
          color: var(--color-text-secondary);
        }
        .cluster-empty {
          text-align: center;
          padding: 60px 20px;
          background-color: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 4px;
        }
        .cluster-empty p {
          color: var(--color-text-secondary);
          margin-bottom: 16px;
        }
        .cluster-list {
          display: grid;
          gap: 16px;
        }
        .cluster-card {
          background-color: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          padding: 16px;
        }
        .cluster-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .cluster-card-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text);
        }
        .cluster-status {
          font-size: 12px;
        }
        .status-success {
          color: #107c10;
          background-color: #dff6dd;
          padding: 2px 8px;
          border-radius: 2px;
        }
        .status-error {
          color: #d83b01;
          background-color: #fdede9;
          padding: 2px 8px;
          border-radius: 2px;
        }
        .cluster-card-body {
          margin-bottom: 12px;
        }
        .cluster-info {
          display: flex;
          margin-bottom: 4px;
          font-size: 13px;
        }
        .cluster-label {
          color: var(--color-text-secondary);
          width: 60px;
        }
        .cluster-value {
          color: var(--color-text);
          font-family: monospace;
        }
        .cluster-card-actions {
          display: flex;
          gap: 8px;
          border-top: 1px solid var(--color-border);
          padding-top: 12px;
          margin-top: 12px;
        }
        .cluster-card-actions .btn {
          padding: 6px 12px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

export default ClusterPanel;
