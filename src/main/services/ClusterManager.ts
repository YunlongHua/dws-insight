import { Client } from 'pg'
import log from 'electron-log'
import { getClusterById, ClusterConfig } from '../storage/config'

export interface Cluster {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
}

let currentConnection: { clusterId: string; client: Client } | null = null

export const clusterManager = {
  async testConnection(cluster: Cluster): Promise<{ success: boolean; message: string }> {
    const client = new Client({
      host: cluster.host,
      port: cluster.port,
      database: cluster.database,
      user: cluster.username,
      password: cluster.password,
      connectionTimeoutMillis: 10000
    })
    try {
      await client.connect()
      const result = await client.query('SELECT version()')
      await client.end()
      return { success: true, message: result.rows[0].version }
    } catch (err: any) {
      log.error('Connection test failed:', err)
      return { success: false, message: err.message }
    }
  },

  async connect(clusterId: string): Promise<{ success: boolean; error?: string }> {
    const clusterConfig = getClusterById(clusterId)
    if (!clusterConfig) {
      return { success: false, error: 'Cluster not found' }
    }

    // Close existing connection if any
    if (currentConnection) {
      try {
        await currentConnection.client.end()
      } catch (err) {
        log.warn('Error closing existing connection:', err)
      }
      currentConnection = null
    }

    const client = new Client({
      host: clusterConfig.host,
      port: clusterConfig.port,
      database: clusterConfig.database,
      user: clusterConfig.user,
      password: clusterConfig.password,
      connectionTimeoutMillis: 10000
    })

    try {
      await client.connect()
      currentConnection = { clusterId, client }
      log.info(`Connected to cluster: ${clusterId}`)
      return { success: true }
    } catch (err: any) {
      log.error('Connection failed:', err)
      return { success: false, error: err.message }
    }
  },

  async executeQuery(sql: string): Promise<{ success: boolean; result?: any; error?: string }> {
    if (!currentConnection) {
      return { success: false, error: 'Not connected to any cluster' }
    }

    try {
      const result = await currentConnection.client.query(sql)
      return { success: true, result }
    } catch (err: any) {
      log.error('Query execution failed:', err)
      return { success: false, error: err.message }
    }
  },

  async getExecutionPlan(sql: string): Promise<{ success: boolean; plan?: any; error?: string }> {
    if (!currentConnection) {
      return { success: false, error: 'Not connected to any cluster' }
    }

    try {
      const result = await currentConnection.client.query(`EXPLAIN (FORMAT JSON) ${sql}`)
      return { success: true, plan: result.rows }
    } catch (err: any) {
      log.error('Execution plan failed:', err)
      return { success: false, error: err.message }
    }
  },

  async disconnect(): Promise<void> {
    if (currentConnection) {
      try {
        await currentConnection.client.end()
        log.info(`Disconnected from cluster: ${currentConnection.clusterId}`)
      } catch (err) {
        log.error('Error disconnecting:', err)
      }
      currentConnection = null
    }
  },

  getCurrentClusterId(): string | null {
    return currentConnection?.clusterId || null
  }
}
