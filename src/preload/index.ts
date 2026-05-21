import { contextBridge, ipcRenderer } from 'electron';

// Progress event callback type
type ProgressCallback = (data: { type: string; message: string; toolName?: string; toolCommand?: string; toolResult?: any; error?: string; content?: string; think?: string; toolMsgId?: string }) => void;

interface Cluster {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
}

interface LLMConfig {
  id?: string;
  name?: string;
  provider: 'openai' | 'custom';
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
  testClusterById: (clusterId: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('cluster:testById', clusterId),
  platform: process.platform,
  // LLM methods
  llmGetAll: (): Promise<{ success: boolean; data?: LLMConfig[]; error?: string }> =>
    ipcRenderer.invoke('llm:getAll'),
  llmGetCurrent: (): Promise<{ success: boolean; data?: LLMConfig; error?: string }> =>
    ipcRenderer.invoke('llm:getCurrent'),
  llmSetCurrent: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('llm:setCurrent', id),
  llmAdd: (config: Omit<LLMConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; data?: LLMConfig; error?: string }> =>
    ipcRenderer.invoke('llm:add', config),
  llmUpdate: (id: string, config: Partial<LLMConfig>): Promise<{ success: boolean; data?: LLMConfig; error?: string }> =>
    ipcRenderer.invoke('llm:update', id, config),
  llmDelete: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('llm:delete', id),
  llmChat: (request: ChatRequest): Promise<{ success: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('llm:chat', request),
  llmTestConnection: (config: LLMConfig): Promise<{ success: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('llm:testConnection', config),
  // SQL methods
  sqlConnect: (config: { host: string; port: number; database: string; user: string; password: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('sql:connect', config),
  sqlExecute: (sql: string): Promise<{ success: boolean; result?: any; error?: string }> =>
    ipcRenderer.invoke('sql:execute', sql),
  sqlPlan: (sql: string): Promise<{ success: boolean; plan?: any; error?: string }> =>
    ipcRenderer.invoke('sql:plan', sql),
  sqlCompare: (originalSql: string, optimizedSql: string): Promise<{ success: boolean; comparison?: any; error?: string }> =>
    ipcRenderer.invoke('sql:compare', originalSql, optimizedSql),
  sqlDisconnect: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('sql:disconnect'),
  // Tuning methods
  tuningAnalyze: (sql: string): Promise<{ success: boolean; suggestions?: any[]; error?: string }> =>
    ipcRenderer.invoke('tuning:analyze', sql),
  tuningWorkflow: (clusterId: string, userInput: string): Promise<{ success: boolean; content?: string; think?: string; error?: string }> =>
    ipcRenderer.invoke('tuning:workflow', clusterId, userInput),
  tuningSaveRecord: (record: {
    original_sql: string;
    optimized_sql: string;
    original_plan: string;
    optimized_plan: string;
    original_result: string;
    optimized_result: string;
    status: 'pending' | 'optimized' | 'failed';
  }): Promise<{ success: boolean; data?: any; error?: string }> =>
    ipcRenderer.invoke('tuning:saveRecord', record),
  tuningGetRecords: (): Promise<{ success: boolean; data?: any[]; error?: string }> =>
    ipcRenderer.invoke('tuning:getRecords'),
  // TestRunner methods
  testRunnerParseRequirements: (requirement: string): Promise<{ success: boolean; testCase?: any; error?: string }> =>
    ipcRenderer.invoke('testRunner:parseRequirements', { requirement }),
  testRunnerExecute: (testCase: any, reportId: number): Promise<{ success: boolean; executedCase?: any; error?: string }> =>
    ipcRenderer.invoke('testRunner:execute', { testCase, reportId }),
  testRunnerGetTestCases: (reportId: number): Promise<{ success: boolean; data?: any[]; error?: string }> =>
    ipcRenderer.invoke('testRunner:getTestCases', reportId),
  testRunnerCreateTestCase: (reportId: number, testCase: any): Promise<{ success: boolean; executedCase?: any; error?: string }> =>
    ipcRenderer.invoke('testRunner:createTestCase', { reportId, testCase }),
  testRunnerSuggestFix: (sql: string, error: string): Promise<{ success: boolean; suggestedFix?: string; error?: string }> =>
    ipcRenderer.invoke('testRunner:suggestFix', sql, error),
  // Report methods
  reportGetAll: (): Promise<{ success: boolean; data?: any[]; error?: string }> =>
    ipcRenderer.invoke('report:getAll'),
  reportCreate: (name: string, description: string): Promise<{ success: boolean; data?: any; error?: string }> =>
    ipcRenderer.invoke('report:create', name, description),
  reportDelete: (id: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('report:delete', id),
  reportExportWord: (reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('report:exportWord', reportId, outputPath),
  reportExportMarkdown: (reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('report:exportMarkdown', reportId, outputPath),
  reportExportPDF: (reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('report:exportPDF', reportId, outputPath),
  // Tuning progress events
  onTuningProgress: (callback: ProgressCallback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('tuning:progress', handler);
    return () => ipcRenderer.removeListener('tuning:progress', handler);
  },
  // Stop tuning workflow
  tuningStop: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('tuning:stop'),
});

console.log('Preload script loaded');
