import { contextBridge, ipcRenderer } from 'electron';

interface Cluster {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  getAppPath: (): Promise<string> => ipcRenderer.invoke('get-app-path'),
  getClusters: (): Promise<Cluster[]> => ipcRenderer.invoke('cluster:getAll'),
  addCluster: (cluster: Omit<Cluster, 'id'>): Promise<Cluster> =>
    ipcRenderer.invoke('cluster:add', cluster),
  updateCluster: (id: string, cluster: Partial<Cluster>): Promise<Cluster> =>
    ipcRenderer.invoke('cluster:update', id, cluster),
  deleteCluster: (id: string): Promise<boolean> => ipcRenderer.invoke('cluster:delete', id),
  testCluster: (cluster: Cluster): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('cluster:test', cluster),
  platform: process.platform,
});

console.log('Preload script loaded');
