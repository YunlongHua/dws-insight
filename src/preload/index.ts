import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  getAppPath: (): Promise<string> => ipcRenderer.invoke('get-app-path'),
  platform: process.platform,
});

console.log('Preload script loaded');
