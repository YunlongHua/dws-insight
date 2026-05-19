import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { initDatabase, closeDatabase } from './storage/database';
import { registerClusterIPC } from './ipc/cluster';
import { registerLLMIPC } from './ipc/llm';
import { registerSQLIPC } from './ipc/sql';
import { registerTuningIPC } from './ipc/tuning';
import { registerTestRunnerIPC } from './ipc/testRunner';
import { registerReportIPC } from './ipc/report';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

log.info('Application starting...');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  log.info('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    log.info('Window ready to show');
    mainWindow?.show();
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

// App lifecycle
app.whenReady().then(() => {
  log.info('App is ready');

  // Register IPC handlers
  registerClusterIPC();
  registerLLMIPC();
  registerSQLIPC();
  registerTuningIPC();
  registerTestRunnerIPC();
  registerReportIPC();

  // Initialize database
  try {
    initDatabase();
    log.info('Database initialized successfully');
  } catch (error) {
    log.error('Failed to initialize database:', error);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('Application quitting...');
  closeDatabase();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});
