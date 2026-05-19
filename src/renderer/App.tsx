import React, { useEffect, useState } from 'react';
import { AppProvider } from './contexts/AppContext';
import Sidebar, { ViewType } from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import MainContent from './components/Layout/MainContent';
import { Cluster } from './contexts/AppContext';
import './styles/global.css';

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getAppPath: () => Promise<string>;
      getClusters: () => Promise<Cluster[]>;
      platform: string;
    };
  }
}

function AppLayout(): React.ReactElement {
  const [activeView, setActiveView] = useState<ViewType>('clusters');
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [currentCluster, setCurrentCluster] = useState<Cluster | null>(null);

  useEffect(() => {
    const loadClusters = async () => {
      try {
        if (window.electronAPI?.getClusters) {
          const clusterList = await window.electronAPI.getClusters();
          setClusters(clusterList);
          if (clusterList.length > 0) {
            setCurrentCluster(clusterList[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load clusters:', error);
      }
    };

    loadClusters();
  }, []);

  const handleClusterChange = (cluster: Cluster) => {
    setCurrentCluster(cluster);
  };

  return (
    <div className="app-container">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <TopBar
        clusters={clusters}
        currentCluster={currentCluster}
        onClusterChange={handleClusterChange}
      />
      <MainContent activeView={activeView} />
    </div>
  );
}

function App(): React.ReactElement {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

export default App;
