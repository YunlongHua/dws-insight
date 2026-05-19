import { ipcMain } from 'electron'
import log from 'electron-log'
import { dwsDirector } from '../services/DWSDirector'

interface DbConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export function registerSQLIPC(): void {
  // Connect to database
  ipcMain.handle('sql:connect', async (_event, config: DbConfig) => {
    log.info('SQL connect request received')
    return await dwsDirector.connect(config)
  })

  // Execute SQL query
  ipcMain.handle('sql:execute', async (_event, sql: string) => {
    log.info('SQL execute request received')
    return await dwsDirector.executeQuery(sql)
  })

  // Get execution plan
  ipcMain.handle('sql:plan', async (_event, sql: string) => {
    log.info('SQL plan request received')
    return await dwsDirector.getExecutionPlan(sql)
  })

  // Compare two SQL queries
  ipcMain.handle('sql:compare', async (_event, originalSql: string, optimizedSql: string) => {
    log.info('SQL compare request received')
    return await dwsDirector.compareResults(originalSql, optimizedSql)
  })

  // Disconnect
  ipcMain.handle('sql:disconnect', async () => {
    log.info('SQL disconnect request received')
    await dwsDirector.disconnect()
    return { success: true }
  })

  log.info('SQL IPC handlers registered')
}
