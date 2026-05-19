import { Client } from 'pg'
import log from 'electron-log'

export interface QueryResult {
  columns: string[]
  rows: any[]
  rowCount: number
  executionTime: number
}

export interface ExecutionPlan {
  plan: any
  executionTime: number
}

export interface CompareResult {
  original: QueryResult
  optimized: QueryResult
  timeDiff: number
  resultDiff: boolean
}

let currentClient: Client | null = null

export const dwsDirector = {
  async connect(config: { host: string; port: number; database: string; user: string; password: string }): Promise<{ success: boolean; error?: string }> {
    try {
      // Close existing connection if any
      if (currentClient) {
        try {
          await currentClient.end()
        } catch (err) {
          log.warn('Error closing existing connection:', err)
        }
        currentClient = null
      }

      currentClient = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionTimeoutMillis: 30000
      })

      await currentClient.connect()
      log.info(`DWSDirector connected to ${config.host}:${config.port}/${config.database}`)
      return { success: true }
    } catch (err: any) {
      log.error('DWSDirector connection failed:', err)
      return { success: false, error: err.message }
    }
  },

  async executeQuery(sql: string): Promise<{ success: boolean; result?: QueryResult; error?: string }> {
    if (!currentClient) {
      return { success: false, error: 'Not connected to database' }
    }

    try {
      const startTime = Date.now()
      const result = await currentClient.query(sql)
      const executionTime = Date.now() - startTime

      const queryResult: QueryResult = {
        columns: result.fields.map(field => field.name),
        rows: result.rows,
        rowCount: result.rowCount || 0,
        executionTime
      }

      log.info(`Query executed in ${executionTime}ms, returned ${result.rowCount || 0} rows`)
      return { success: true, result: queryResult }
    } catch (err: any) {
      log.error('Query execution failed:', err)
      return { success: false, error: err.message }
    }
  },

  async getExecutionPlan(sql: string): Promise<{ success: boolean; plan?: ExecutionPlan; error?: string }> {
    if (!currentClient) {
      return { success: false, error: 'Not connected to database' }
    }

    try {
      const startTime = Date.now()
      const result = await currentClient.query(`EXPLAIN (FORMAT JSON) ${sql}`)
      const executionTime = Date.now() - startTime

      const plan: ExecutionPlan = {
        plan: result.rows,
        executionTime
      }

      log.info(`Execution plan generated in ${executionTime}ms`)
      return { success: true, plan }
    } catch (err: any) {
      log.error('Execution plan failed:', err)
      return { success: false, error: err.message }
    }
  },

  async compareResults(originalSql: string, optimizedSql: string): Promise<{ success: boolean; comparison?: CompareResult; error?: string }> {
    if (!currentClient) {
      return { success: false, error: 'Not connected to database' }
    }

    try {
      // Execute original query
      const originalResult = await this.executeQuery(originalSql)
      if (!originalResult.success || !originalResult.result) {
        return { success: false, error: `Original query failed: ${originalResult.error}` }
      }

      // Execute optimized query
      const optimizedResult = await this.executeQuery(optimizedSql)
      if (!optimizedResult.success || !optimizedResult.result) {
        return { success: false, error: `Optimized query failed: ${optimizedResult.error}` }
      }

      const timeDiff = optimizedResult.result.executionTime - originalResult.result.executionTime

      // Compare results
      let resultDiff = false
      if (originalResult.result.rowCount !== optimizedResult.result.rowCount) {
        resultDiff = true
      } else {
        // Deep compare rows
        const originalJson = JSON.stringify(originalResult.result.rows)
        const optimizedJson = JSON.stringify(optimizedResult.result.rows)
        resultDiff = originalJson !== optimizedJson
      }

      const comparison: CompareResult = {
        original: originalResult.result,
        optimized: optimizedResult.result,
        timeDiff,
        resultDiff
      }

      log.info(`Comparison complete: timeDiff=${timeDiff}ms, resultDiff=${resultDiff}`)
      return { success: true, comparison }
    } catch (err: any) {
      log.error('Compare results failed:', err)
      return { success: false, error: err.message }
    }
  },

  async disconnect(): Promise<void> {
    if (currentClient) {
      try {
        await currentClient.end()
        log.info('DWSDirector disconnected')
      } catch (err) {
        log.error('Error disconnecting DWSDirector:', err)
      }
      currentClient = null
    }
  }
}
