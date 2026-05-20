import { Client, ssl } from 'pg'
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
    // Try with SSL first, then without
    const sslOptions = { rejectUnauthorized: false }

    // Try SSL connection first
    const sslClient = new Client({
      host: cluster.host,
      port: cluster.port,
      database: cluster.database,
      user: cluster.username,
      password: cluster.password,
      connectionTimeoutMillis: 15000,
      ssl: sslOptions
    })

    try {
      await sslClient.connect()
      const result = await sslClient.query('SELECT version()')
      await sslClient.end()
      log.info(`SSL connection successful to ${cluster.host}:${cluster.port}`)
      return { success: true, message: result.rows[0].version }
    } catch (err: any) {
      log.warn(`SSL connection failed, trying without SSL: ${err.message}`)

      // Try without SSL
      const client = new Client({
        host: cluster.host,
        port: cluster.port,
        database: cluster.database,
        user: cluster.username,
        password: cluster.password,
        connectionTimeoutMillis: 15000
      })

      try {
        await client.connect()
        const result = await client.query('SELECT version()')
        await client.end()
        log.info(`Non-SSL connection successful to ${cluster.host}:${cluster.port}`)
        return { success: true, message: result.rows[0].version }
      } catch (err2: any) {
        log.error(`Connection failed (SSL and non-SSL): ${err2.message}`)
        return { success: false, message: err2.message }
      }
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

    const sslOptions = { rejectUnauthorized: false }

    // Try SSL first
    const sslClient = new Client({
      host: clusterConfig.host,
      port: clusterConfig.port,
      database: clusterConfig.database,
      user: clusterConfig.user,
      password: clusterConfig.password,
      connectionTimeoutMillis: 15000,
      ssl: sslOptions
    })

    let clientError = ''

    try {
      await sslClient.connect()
      currentConnection = { clusterId, client: sslClient }
      log.info(`Connected to cluster (SSL): ${clusterId}`)
      return { success: true }
    } catch (err: any) {
      log.warn(`SSL connection failed, trying without SSL: ${err.message}`)
      clientError = err.message

      // Try without SSL
      const client = new Client({
        host: clusterConfig.host,
        port: clusterConfig.port,
        database: clusterConfig.database,
        user: clusterConfig.user,
        password: clusterConfig.password,
        connectionTimeoutMillis: 15000
      })

      try {
        await client.connect()
        currentConnection = { clusterId, client }
        log.info(`Connected to cluster (non-SSL): ${clusterId}`)
        return { success: true }
      } catch (err2: any) {
        log.error(`Connection failed: ${err2.message}`)
        return { success: false, error: err2.message }
      }
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
