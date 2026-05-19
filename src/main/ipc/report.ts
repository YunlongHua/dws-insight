import { ipcMain } from 'electron';
import log from 'electron-log';
import { createReport, getReports, deleteReport } from '../storage/database';
import { reportExporter } from '../services/ReportExporter';

export function registerReportIPC(): void {
  // Get all reports
  ipcMain.handle('report:getAll', async () => {
    log.info('Report get all request received');
    try {
      const reports = getReports();
      return { success: true, data: reports };
    } catch (err: any) {
      log.error('Error getting reports:', err);
      return { success: false, error: err.message };
    }
  });

  // Create a new report
  ipcMain.handle('report:create', async (_event, name: string, description: string) => {
    log.info('Report create request received:', name);
    try {
      const report = createReport({ name, description });
      return { success: true, data: report };
    } catch (err: any) {
      log.error('Error creating report:', err);
      return { success: false, error: err.message };
    }
  });

  // Delete a report
  ipcMain.handle('report:delete', async (_event, id: number) => {
    log.info('Report delete request received:', id);
    try {
      const success = deleteReport(id);
      return { success };
    } catch (err: any) {
      log.error('Error deleting report:', err);
      return { success: false, error: err.message };
    }
  });

  // Export report to Word
  ipcMain.handle('report:exportWord', async (_event, reportId: string, outputPath: string) => {
    log.info('Report export to Word request received:', reportId);
    try {
      const result = await reportExporter.exportToWord(reportId, outputPath);
      return result;
    } catch (err: any) {
      log.error('Error exporting report to Word:', err);
      return { success: false, error: err.message };
    }
  });

  // Export report to Markdown
  ipcMain.handle('report:exportMarkdown', async (_event, reportId: string, outputPath: string) => {
    log.info('Report export to Markdown request received:', reportId);
    try {
      const result = await reportExporter.exportToMarkdown(reportId, outputPath);
      return result;
    } catch (err: any) {
      log.error('Error exporting report to Markdown:', err);
      return { success: false, error: err.message };
    }
  });

  // Export report to PDF
  ipcMain.handle('report:exportPDF', async (_event, reportId: string, outputPath: string) => {
    log.info('Report export to PDF request received:', reportId);
    try {
      const result = await reportExporter.exportToPDF(reportId, outputPath);
      return result;
    } catch (err: any) {
      log.error('Error exporting report to PDF:', err);
      return { success: false, error: err.message };
    }
  });

  log.info('Report IPC handlers registered');
}