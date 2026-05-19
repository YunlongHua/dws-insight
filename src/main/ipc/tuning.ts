import { ipcMain } from 'electron';
import log from 'electron-log';
import { tuningAdvisor, TuningSuggestion } from '../services/TuningAdvisor';
import { saveTuningRecord, getTuningRecords } from '../storage/database';

export function registerTuningIPC(): void {
  // Analyze SQL with tuning suggestions
  ipcMain.handle(
    'tuning:analyze',
    async (_event, sql: string): Promise<{ success: boolean; suggestions?: TuningSuggestion[]; error?: string }> => {
      log.info('Tuning analyze request received');
      return await tuningAdvisor.analyze(sql);
    }
  );

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
