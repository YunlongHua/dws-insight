import React from 'react';

interface Cluster {
  id: string;
  name: string;
}

interface TopBarProps {
  clusters: Cluster[];
  currentCluster: Cluster | null;
  onClusterChange: (cluster: Cluster) => void;
}

function TopBar({ clusters, currentCluster, onClusterChange }: TopBarProps): React.ReactElement {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const cluster = clusters.find((c) => c.id === selectedId);
    if (cluster) {
      onClusterChange(cluster);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">Data Warehouse Service</span>
      </div>
      <div className="topbar-right">
        <div className="cluster-selector">
          <span className="cluster-selector-label">当前集群:</span>
          <select
            value={currentCluster?.id || ''}
            onChange={handleChange}
            disabled={clusters.length === 0}
          >
            {clusters.length === 0 ? (
              <option value="">暂无集群</option>
            ) : (
              clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
