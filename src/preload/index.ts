import { contextBridge, ipcRenderer } from 'electron';

interface Cluster {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
}

interface LLMConfig {
  provider: 'openai' | 'eimaas' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  sessionId: string;
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
  // LLM methods
  llmGetConfig: (): Promise<{ success: boolean; data?: LLMConfig; error?: string }> =>
    ipcRenderer.invoke('llm:getConfig'),
  llmSetConfig: (config: Omit<LLMConfig, 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; data?: LLMConfig; error?: string }> =>
    ipcRenderer.invoke('llm:setConfig', config),
  llmChat: (request: ChatRequest): Promise<{ success: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('llm:chat', request),
  llmGetMessages: (sessionId: string): Promise<{ success: boolean; data?: Message[]; error?: string }> =>
    ipcRenderer.invoke('llm:getMessages', sessionId),
});

console.log('Preload script loaded');
