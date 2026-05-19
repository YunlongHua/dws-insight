import { ipcMain } from 'electron'
import log from 'electron-log'
import { clusterManager, Cluster } from '../services/ClusterManager'
import {
  getClusters,
  addCluster,
  updateCluster,
  deleteCluster,
  getClusterById,
  ClusterConfig
} from '../storage/config'
import * as crypto from 'crypto'

function generateId(): string {
  return crypto.randomUUID()
}

export function registerClusterIPC(): void {
  log.info('Registering cluster IPC handlers')

  // cluster:getAll - get all clusters from config
  ipcMain.handle('cluster:getAll', async () => {
    try {
      const clusters = getClusters()
      // Map ClusterConfig to Cluster (exclude sensitive data for listing)
      return clusters.map(({ id, name, host, port, database, user }) => ({
        id,
        name,
        host,
        port,
        database,
        username: user
      }))
    } catch (err: any) {
      log.error('cluster:getAll error:', err)
      return []
    }
  })

  // cluster:get - get single cluster by id
  ipcMain.handle('cluster:get', async (_, id: string) => {
    try {
      const cluster = getClusterById(id)
      if (!cluster) return null
      return {
        id: cluster.id,
        name: cluster.name,
        host: cluster.host,
        port: cluster.port,
        database: cluster.database,
        username: cluster.user
      }
    } catch (err: any) {
      log.error('cluster:get error:', err)
      return null
    }
  })

  // cluster:add - add new cluster
  ipcMain.handle('cluster:add', async (_, clusterData: Omit<Cluster, 'id'>) => {
    try {
      const id = generateId()
      const newCluster = addCluster({
        id,
        name: clusterData.name,
        host: clusterData.host,
        port: clusterData.port,
        database: clusterData.database,
        user: clusterData.username,
        password: clusterData.password,
        ssl: false
      })
      log.info(`Cluster added via IPC: ${id}`)
      return {
        id: newCluster.id,
        name: newCluster.name,
        host: newCluster.host,
        port: newCluster.port,
        database: newCluster.database,
        username: newCluster.user
      }
    } catch (err: any) {
      log.error('cluster:add error:', err)
      throw err
    }
  })

  // cluster:update - update cluster
  ipcMain.handle('cluster:update', async (_, id: string, updates: Partial<Cluster>) => {
    try {
      const updateData: any = {}
      if (updates.name) updateData.name = updates.name
      if (updates.host) updateData.host = updates.host
      if (updates.port) updateData.port = updates.port
      if (updates.database) updateData.database = updates.database
      if (updates.username) updateData.user = updates.username
      if (updates.password) updateData.password = updates.password

      const updated = updateCluster(id, updateData)
      if (!updated) {
        throw new Error('Cluster not found')
      }
      log.info(`Cluster updated via IPC: ${id}`)
      return {
        id: updated.id,
        name: updated.name,
        host: updated.host,
        port: updated.port,
        database: updated.database,
        username: updated.user
      }
    } catch (err: any) {
      log.error('cluster:update error:', err)
      throw err
    }
  })

  // cluster:delete - delete cluster
  ipcMain.handle('cluster:delete', async (_, id: string) => {
    try {
      const result = deleteCluster(id)
      log.info(`Cluster deleted via IPC: ${id}, success: ${result}`)
      return result
    } catch (err: any) {
      log.error('cluster:delete error:', err)
      throw err
    }
  })

  // cluster:test - test connection
  ipcMain.handle('cluster:test', async (_, cluster: Cluster) => {
    try {
      const result = await clusterManager.testConnection(cluster)
      log.info(`Cluster connection test: ${cluster.name}, success: ${result.success}`)
      return result
    } catch (err: any) {
      log.error('cluster:test error:', err)
      return { success: false, message: err.message }
    }
  })

  // cluster:connect - connect to cluster
  ipcMain.handle('cluster:connect', async (_, clusterId: string) => {
    try {
      const result = await clusterManager.connect(clusterId)
      log.info(`Cluster connect: ${clusterId}, success: ${result.success}`)
      return result
    } catch (err: any) {
      log.error('cluster:connect error:', err)
      return { success: false, error: err.message }
    }
  })

  // cluster:disconnect - disconnect from cluster
  ipcMain.handle('cluster:disconnect', async () => {
    try {
      await clusterManager.disconnect()
      return { success: true }
    } catch (err: any) {
      log.error('cluster:disconnect error:', err)
      return { success: false, error: err.message }
    }
  })

  // cluster:execute - execute SQL query
  ipcMain.handle('cluster:execute', async (_, sql: string) => {
    try {
      const result = await clusterManager.executeQuery(sql)
      return result
    } catch (err: any) {
      log.error('cluster:execute error:', err)
      return { success: false, error: err.message }
    }
  })

  // cluster:getExecutionPlan - get query execution plan
  ipcMain.handle('cluster:getExecutionPlan', async (_, sql: string) => {
    try {
      const result = await clusterManager.getExecutionPlan(sql)
      return result
    } catch (err: any) {
      log.error('cluster:getExecutionPlan error:', err)
      return { success: false, error: err.message }
    }
  })

  log.info('Cluster IPC handlers registered successfully')
}
