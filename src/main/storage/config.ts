import Store from 'electron-store';
import log from 'electron-log';
import * as crypto from 'crypto';

// Derive a machine-specific encryption key using hostname
function getDerivedEncryptionKey(): string {
  const hostname = require('os').hostname();
  const appName = 'dws-ui';
  const salt = `${appName}-${hostname}`;
  return crypto.createHash('sha256').update(salt).digest('hex').substring(0, 32);
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClusterConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LLMConfig {
  id: string;
  name: string;
  provider: 'openai' | 'custom';
  apiKey?: string;
  model?: string;
  endpoint?: string;
  baseUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreSchema {
  clusters: Record<string, ClusterConfig>;
  currentClusterId: string | null;
  llmConfigs: Record<string, LLMConfig>;
  currentLLMConfigId: string | null;
}

const store = new Store<StoreSchema>({
  name: 'dws-config',
  encryptionKey: getDerivedEncryptionKey(),
  defaults: {
    clusters: {},
    currentClusterId: null,
    llmConfigs: {},
    currentLLMConfigId: null,
  },
});

log.info('Config store initialized');

// Cluster operations
export function getClusters(): ClusterConfig[] {
  const clusters = store.get('clusters', {});
  return Object.values(clusters);
}

export function getClusterById(id: string): ClusterConfig | undefined {
  const clusters = store.get('clusters', {});
  return clusters[id];
}

export function addCluster(cluster: Omit<ClusterConfig, 'createdAt' | 'updatedAt'>): ClusterConfig {
  const clusters = store.get('clusters', {});
  const now = new Date().toISOString();
  const newCluster: ClusterConfig = {
    ...cluster,
    createdAt: now,
    updatedAt: now,
  };
  clusters[cluster.id] = newCluster;
  store.set('clusters', clusters);
  log.info(`Cluster added: ${cluster.id}`);
  return newCluster;
}

export function updateCluster(id: string, updates: Partial<ClusterConfig>): ClusterConfig | null {
  const clusters = store.get('clusters', {});
  if (!clusters[id]) {
    return null;
  }
  const updated: ClusterConfig = {
    ...clusters[id],
    ...updates,
    id, // Ensure ID cannot be changed
    updatedAt: new Date().toISOString(),
  };
  clusters[id] = updated;
  store.set('clusters', clusters);
  log.info(`Cluster updated: ${id}`);
  return updated;
}

export function deleteCluster(id: string): boolean {
  const clusters = store.get('clusters', {});
  if (!clusters[id]) {
    return false;
  }
  delete clusters[id];
  store.set('clusters', clusters);
  log.info(`Cluster deleted: ${id}`);

  // Clear current cluster ID if it was deleted
  if (store.get('currentClusterId') === id) {
    store.set('currentClusterId', null);
  }

  return true;
}

// Current cluster operations
export function getCurrentClusterId(): string | null {
  return store.get('currentClusterId', null);
}

export function setCurrentClusterId(id: string | null): void {
  store.set('currentClusterId', id);
  log.info(`Current cluster ID set: ${id}`);
}

export function getCurrentCluster(): ClusterConfig | null {
  const id = getCurrentClusterId();
  if (!id) return null;
  return getClusterById(id) || null;
}

// LLM config operations
export function getLLMConfigs(): LLMConfig[] {
  const configs = store.get('llmConfigs', {});
  return Object.values(configs);
}

export function getLLMConfigById(id: string): LLMConfig | undefined {
  const configs = store.get('llmConfigs', {});
  return configs[id];
}

export function getCurrentLLMConfigId(): string | null {
  return store.get('currentLLMConfigId', null);
}

export function setCurrentLLMConfigId(id: string | null): void {
  store.set('currentLLMConfigId', id);
  log.info(`Current LLM config ID set: ${id}`);
}

export function getCurrentLLMConfig(): LLMConfig | null {
  const id = getCurrentLLMConfigId();
  if (!id) return null;
  return getLLMConfigById(id) || null;
}

export function addLLMConfig(config: Omit<LLMConfig, 'id' | 'createdAt' | 'updatedAt'>): LLMConfig {
  const configs = store.get('llmConfigs', {});
  const now = new Date().toISOString();
  const id = `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newConfig: LLMConfig = {
    ...config,
    id,
    createdAt: now,
    updatedAt: now,
  };
  configs[id] = newConfig;
  store.set('llmConfigs', configs);
  log.info(`LLM config added: ${id}`);
  return newConfig;
}

export function updateLLMConfig(id: string, updates: Partial<LLMConfig>): LLMConfig | null {
  const configs = store.get('llmConfigs', {});
  if (!configs[id]) {
    return null;
  }
  const updated: LLMConfig = {
    ...configs[id],
    ...updates,
    id, // Ensure ID cannot be changed
    updatedAt: new Date().toISOString(),
  };
  configs[id] = updated;
  store.set('llmConfigs', configs);
  log.info(`LLM config updated: ${id}`);
  return updated;
}

export function deleteLLMConfig(id: string): boolean {
  const configs = store.get('llmConfigs', {});
  if (!configs[id]) {
    return false;
  }
  delete configs[id];
  store.set('llmConfigs', configs);
  log.info(`LLM config deleted: ${id}`);

  // Clear current config ID if it was deleted
  if (store.get('currentLLMConfigId') === id) {
    store.set('currentLLMConfigId', null);
  }

  return true;
}

export default store;
