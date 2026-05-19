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
  provider: 'openai' | 'anthropic' | 'azure';
  apiKey: string;
  model?: string;
  endpoint?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreSchema {
  clusters: Record<string, ClusterConfig>;
  currentClusterId: string | null;
  llmConfig: LLMConfig | null;
}

const store = new Store<StoreSchema>({
  name: 'dws-config',
  encryptionKey: getDerivedEncryptionKey(),
  defaults: {
    clusters: {},
    currentClusterId: null,
    llmConfig: null,
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
export function getLLMConfig(): LLMConfig | null {
  return store.get('llmConfig', null);
}

export function setLLMConfig(config: Omit<LLMConfig, 'createdAt' | 'updatedAt'>): LLMConfig {
  const now = new Date().toISOString();
  const newConfig: LLMConfig = {
    ...config,
    createdAt: now,
    updatedAt: now,
  };
  store.set('llmConfig', newConfig);
  log.info(`LLM config updated for provider: ${config.provider}`);
  return newConfig;
}

export default store;
