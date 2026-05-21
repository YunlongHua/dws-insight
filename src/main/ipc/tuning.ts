import { ipcMain } from 'electron';
import log from 'electron-log';
import { tuningAdvisor, TuningSuggestion } from '../services/TuningAdvisor';
import { TuningWorkflowEngine } from '../services/TuningWorkflowEngine';
import { saveTuningRecord, getTuningRecords } from '../storage/database';

// Store reference to current engine for stop functionality
let currentEngine: TuningWorkflowEngine | null = null;

export function registerTuningIPC(): void {
  // Analyze SQL with tuning suggestions
  ipcMain.handle(
    'tuning:analyze',
    async (_event, sql: string): Promise<{ success: boolean; suggestions?: TuningSuggestion[]; error?: string }> => {
      log.info('Tuning analyze request received');
      return await tuningAdvisor.analyze(sql);
    }
  );

  // Tool-augmented tuning workflow with progress updates
  ipcMain.handle(
    'tuning:workflow',
    async (event, clusterId: string, userInput: string) => {
      log.info(`Tuning workflow request for cluster ${clusterId}`);

      // Collect progress updates
      const progressLogs: string[] = [];

      const engine = new TuningWorkflowEngine(clusterId, (update) => {
        // Send progress update to renderer
        event.sender.send('tuning:progress', {
          type: update.type,
          message: update.message,
          toolName: update.toolName,
          toolCommand: update.toolCommand,
          toolResult: update.toolResult,
          error: update.error,
          toolMsgId: update.toolMsgId
        });
        progressLogs.push(update.message);
      });

      currentEngine = engine;

      try {
        const result = await engine.run(userInput);
        currentEngine = null;
        // Send final result
        event.sender.send('tuning:progress', {
          type: 'final',
          message: result.success ? '完成' : result.error,
          content: result.content,
          think: result.think
        });
        return { success: true, progressLogs };
      } catch (err: any) {
        currentEngine = null;
        log.error('Tuning workflow error:', err);
        event.sender.send('tuning:progress', {
          type: 'final',
          message: err.message,
          error: err.message
        });
        return { success: false, error: err.message };
      }
    }
  );

  // Stop the current tuning workflow
  ipcMain.handle('tuning:stop', async () => {
    log.info('Stop tuning workflow request');
    if (currentEngine) {
      currentEngine.stop();
      currentEngine = null;
      return { success: true };
    }
    return { success: false, error: '没有正在运行的 workflow' };
  });

  // Save a tuning record
  ipcMain.handle(
    'tuning:saveRecord',
    async (
      _event,
      record: {
        original_sql: string;
        optimized_sql: string;
        original_plan: string;
        optimized_plan: string;
        original_result: string;
        optimized_result: string;
        status: 'pending' | 'optimized' | 'failed';
      }
    ) => {
      log.info('Saving tuning record');
      try {
        const saved = saveTuningRecord(record);
        return { success: true, data: saved };
      } catch (err: any) {
        log.error('Failed to save tuning record:', err);
        return { success: false, error: err.message };
      }
    }
  );

  // Get all tuning records
  ipcMain.handle('tuning:getRecords', async () => {
    log.info('Getting tuning records');
    try {
      const records = getTuningRecords();
      return { success: true, data: records };
    } catch (err: any) {
      log.error('Failed to get tuning records:', err);
      return { success: false, error: err.message };
    }
  });

  log.info('Tuning IPC handlers registered');
}
