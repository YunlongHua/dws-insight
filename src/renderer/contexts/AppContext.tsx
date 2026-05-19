import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Cluster {
  id: string;
  name: string;
}

interface AppContextValue {
  clusters: Cluster[];
  currentCluster: Cluster | null;
  setClusters: (clusters: Cluster[]) => void;
  setCurrentCluster: (cluster: Cluster | null) => void;
  refreshClusters: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

function AppProvider({ children }: AppProviderProps): React.ReactElement {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [currentCluster, setCurrentCluster] = useState<Cluster | null>(null);

  const refreshClusters = useCallback(async () => {
    try {
      if (window.electronAPI?.getClusters) {
        const clusterList = await window.electronAPI.getClusters();
        setClusters(clusterList);
        if (clusterList.length > 0 && !currentCluster) {
          setCurrentCluster(clusterList[0]);
        }
      }
    } catch (error) {
      console.error('Failed to refresh clusters:', error);
    }
  }, [currentCluster]);

  const value: AppContextValue = {
    clusters,
    currentCluster,
    setClusters,
    setCurrentCluster,
    refreshClusters,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export { AppProvider, useAppContext };
export type { Cluster };
