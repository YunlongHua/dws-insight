import log from 'electron-log';
import { Message } from './LLMGateway';
import { llmGateway } from './LLMGateway';
import { clusterManager } from './ClusterManager';
import { getClusterById } from '../storage/config';
import { ipcMain } from 'electron';

interface ToolCommand {
  tool: string;
  args: Record<string, any>;
}

interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

interface ProgressUpdate {
  type: 'progress' | 'tool_result' | 'final';
  message: string;
  toolName?: string;
  toolCommand?: string;
  toolResult?: any;
  error?: string;
  toolMsgId?: string;
}

function parseToolCommands(content: string): ToolCommand[] {
  const commands: ToolCommand[] = [];

  // Try to parse JSON format (OpenAI tool_calls format)
  try {
    const json = JSON.parse(content);
    if (json.toolCalls && Array.isArray(json.toolCalls)) {
      for (const tc of json.toolCalls) {
        if (tc.name && tc.arguments) {
          commands.push({
            tool: tc.name.toLowerCase(),
            args: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments
          });
        }
      }
      if (commands.length > 0) {
        return commands;
      }
    }
  } catch {
    // Not JSON format, continue with text format
  }

  // Text format: [TOOL_NAME]...[/TOOL_NAME]
  const regex = /\[(getSchema|executeSQL|getPlan|getStats|getClusterInfo)\]([\s\S]*?)\[\/\1\]/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tool = match[1].toLowerCase();
    let args: Record<string, any> = {};

    try {
      const argStr = match[2].trim();
      if (argStr) {
        args = JSON.parse(argStr);
      }
    } catch {
      if (match[2].trim()) {
        args = { sql: match[2].trim() };
        if (tool === 'getschema') args = { tableName: match[2].trim() };
        if (tool === 'getstats') args = { tableName: match[2].trim() };
      }
    }

    commands.push({ tool, args });
  }
  return commands;
}

function extractFinalContent(content: string): string {
  // Try to parse JSON format first
  try {
    const json = JSON.parse(content);
    if (json.toolCalls) {
      // If content is just tool calls, return empty
      return '';
    }
  } catch {
    // Not JSON, continue with text format
  }

  // Remove text format tool calls
  return content.replace(/\[(getSchema|executeSQL|getPlan|getStats|getClusterInfo)\][\s\S]*?\[\/\1\]/gi, '').trim();
}

const SYSTEM_PROMPT = `你是一个 DWS SQL 调优专家。你可以通过调用工具来获取数据库信息并分析 SQL 性能。

**工具调用格式**：在回答中包含以下格式的命令：

- 执行 SQL：[executeSQL]SELECT ...[/executeSQL]
- 获取执行计划：[getPlan]SELECT ...[/getPlan]
- 获取表结构：[getSchema]表名[/getSchema]
- 获取表统计：[getStats]表名[/getStats]
- 获取集群信息：[getClusterInfo][/getClusterInfo]

**重要**：
1. 每次回复后，请等待工具执行结果
2. 根据结果再决定下一步
3. 给出最终分析和建议

请开始分析。`;

export class TuningWorkflowEngine {
  private clusterId: string;
  private messages: Message[] = [];
  private maxIterations: number = 15;
  private currentIteration: number = 0;
  private sessionId: string;
  private onProgress?: (update: ProgressUpdate) => void;
  private aborted: boolean = false;

  constructor(clusterId: string, onProgress?: (update: ProgressUpdate) => void) {
    this.clusterId = clusterId;
    this.sessionId = `tuning-${Date.now()}`;
    this.onProgress = onProgress;
  }

  stop() {
    this.aborted = true;
  }

  async run(userInput: string) {
    this.messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userInput }
    ];
    this.currentIteration = 0;
    this.aborted = false;

    const connectResult = await this.ensureConnection();
    if (!connectResult.success) {
      return { success: false, error: `无法连接到集群: ${connectResult.error}` };
    }

    let lastContent = '';

    while (this.currentIteration < this.maxIterations && !this.aborted) {
      this.currentIteration++;

      const response = await llmGateway.chatWithConfig(this.messages, this.getLLMConfig());

      if (this.aborted) break;

      if (!response.success) {
        return { success: false, error: response.error };
      }

      const content = response.content || '';
      lastContent = content;
      this.messages.push({ role: 'assistant', content });

      const commands = parseToolCommands(content);

      if (commands.length === 0) {
        return {
          success: true,
          content: extractFinalContent(content),
          think: response.think
        };
      }

      for (const cmd of commands) {
        if (this.aborted) break;

        const cmdArgs = JSON.stringify(cmd.args);
        const toolMsgId = `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Format command for display based on tool type
        let displayCommand = cmdArgs;
        if (cmd.tool === 'getplan' && cmd.args.sql) {
          displayCommand = `EXPLAIN ${cmd.args.sql}`;
        } else if ((cmd.tool === 'executesql' || cmd.tool === 'getplan') && cmd.args.sql) {
          displayCommand = cmd.args.sql;
        } else if ((cmd.tool === 'getschema' || cmd.tool === 'getstats') && cmd.args.tableName) {
          displayCommand = cmd.args.tableName;
        }

        // Emit tool_start before execution
        this.emitProgress('tool_start', `🔧 执行 ${cmd.tool}...`, cmd.tool, displayCommand, undefined, undefined, toolMsgId);

        const result = await this.executeTool(cmd.tool, cmd.args);

        if (this.aborted) break;

        if (result.success) {
          this.emitProgress('tool_result', `✅ ${cmd.tool} 执行成功`, cmd.tool, displayCommand, result.result, undefined, toolMsgId);
        } else {
          this.emitProgress('tool_error', `❌ ${cmd.tool} 执行失败: ${result.error}`, cmd.tool, displayCommand, undefined, result.error, toolMsgId);
        }

        const resultMessage = result.success
          ? `[${cmd.tool.toUpperCase()}_RESULT]\n${this.formatResult(result.result)}[/${cmd.tool.toUpperCase()}_RESULT]`
          : `[${cmd.tool.toUpperCase()}_ERROR]\n${result.error}[/${cmd.tool.toUpperCase()}_ERROR]`;

        this.messages.push({ role: 'user', content: resultMessage });
      }
    }

    if (this.aborted) {
      return { success: false, error: '用户已终止' };
    }

    this.emitProgress('info', '⚠️ 分析超时');
    return { success: false, error: '分析超时，请尝试更简单的 SQL 语句' };
  }

  private emitProgress(type: string, message: string, toolName?: string, toolCommand?: string, toolResult?: any, error?: string, toolMsgId?: string) {
    this.onProgress?.({ type, message, toolName, toolCommand, toolResult, error, toolMsgId });
  }

  private formatResult(result: any): string {
    if (!result) return '无结果';
    if (typeof result === 'string') return result;
    if (Array.isArray(result)) {
      if (result.length === 0) return '无数据';
      if (result.length <= 5) return JSON.stringify(result, null, 2);
      return `共 ${result.length} 条记录:\n${JSON.stringify(result.slice(0, 3), null, 2)}\n...`;
    }
    return JSON.stringify(result, null, 2);
  }

  private async executeTool(tool: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      switch (tool.toLowerCase()) {
        case 'getclusterinfo':
          return this.getClusterInfo();
        case 'getschema':
          return await this.getTableSchema(args.tableName || args.table || args.sql);
        case 'executesql':
          return await this.executeSQL(args.sql);
        case 'getplan':
          return await this.getExecutionPlan(args.sql);
        case 'getstats':
          return await this.getTableStats(args.tableName || args.table);
        default:
          return { success: false, error: `未知工具: ${tool}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private getClusterInfo(): ToolResult {
    const cluster = getClusterById(this.clusterId);
    if (!cluster) {
      return { success: false, error: '集群不存在' };
    }
    return {
      success: true,
      result: {
        name: cluster.name,
        host: cluster.host,
        port: cluster.port,
        database: cluster.database,
        user: cluster.user
      }
    };
  }

  private async getTableSchema(tableName: string): Promise<ToolResult> {
    if (!tableName) {
      return { success: false, error: '请提供表名' };
    }

    const sql = `SELECT
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      CASE WHEN pk.column_name IS NOT NULL THEN 'YES' ELSE 'NO' END as is_primary_key
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = '${tableName}'
        AND tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON c.column_name = pk.column_name
    WHERE c.table_name = '${tableName}'
      AND c.table_schema = 'public'
    ORDER BY c.ordinal_position`;

    const result = await clusterManager.executeQuery(sql);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const rows = result.result?.rows;
    if (!rows || rows.length === 0) {
      return { success: true, result: JSON.stringify({ message: `表 ${tableName} 不存在或没有列信息` }) };
    }

    // Return raw JSON result
    return { success: true, result: JSON.stringify(rows, null, 2) };
  }

  private async executeSQL(sql: string): Promise<ToolResult> {
    if (!sql) {
      return { success: false, error: '请提供 SQL 语句' };
    }
    const result = await clusterManager.executeQuery(sql);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const pgResult = result.result;
    if (!pgResult) {
      return { success: true, result: '无数据' };
    }

    // Extract rows from pg query result
    const rows = pgResult.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: true, result: '无数据' };
    }

    // Format as a markdown table
    const headers = Object.keys(rows[0]);
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const rowStrs = rows.map(row =>
      `| ${headers.map(h => String(row[h] ?? '')).join(' | ')} |`
    ).join('\n');

    return { success: true, result: `${headerRow}\n${separatorRow}\n${rowStrs}` };
  }

  private async getExecutionPlan(sql: string): Promise<ToolResult> {
    if (!sql) {
      return { success: false, error: '请提供 SQL 语句' };
    }
    const result = await clusterManager.getExecutionPlan(sql);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // result.plan contains the EXPLAIN JSON output
    const planData = result.plan;
    if (!planData) {
      return { success: true, result: JSON.stringify({ message: '无执行计划' }) };
    }

    // Return raw JSON result
    return { success: true, result: JSON.stringify(planData, null, 2) };
  }

  private async getTableStats(tableName: string): ToolResult {
    if (!tableName) {
      return { success: false, error: '请提供表名' };
    }
    const sql = `SELECT
      schemaname,
      tablename,
      n_live_tup as row_count,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
    FROM pg_stat_user_tables
    WHERE tablename = '${tableName}'`;

    const result = await clusterManager.executeQuery(sql);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const rows = result.result?.rows;
    if (!rows || rows.length === 0) {
      return { success: true, result: JSON.stringify({ message: `表 ${tableName} 没有统计信息` }) };
    }

    // Return raw JSON result
    return { success: true, result: JSON.stringify(rows, null, 2) };
  }

  private async ensureConnection(): Promise<ToolResult> {
    const cluster = getClusterById(this.clusterId);
    if (!cluster) {
      return { success: false, error: '集群不存在' };
    }
    const result = await clusterManager.connect(this.clusterId);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  private getLLMConfig() {
    const { getCurrentLLMConfig } = require('../storage/config');
    const config = getCurrentLLMConfig();
    if (!config) {
      throw new Error('LLM not configured');
    }
    return config;
  }
}

export default TuningWorkflowEngine;
