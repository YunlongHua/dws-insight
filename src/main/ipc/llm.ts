import { ipcMain } from 'electron';
import log from 'electron-log';
import {
  getLLMConfigs,
  getLLMConfigById,
  addLLMConfig,
  updateLLMConfig,
  deleteLLMConfig,
  getCurrentLLMConfigId,
  setCurrentLLMConfigId,
  getCurrentLLMConfig,
  LLMConfig
} from '../storage/config';
import { llmGateway, Message } from '../services/LLMGateway';

export function registerLLMIPC(): void {
  // Get all LLM configs
  ipcMain.handle('llm:getAll', async () => {
    try {
      log.info('Getting all LLM configs');
      const configs = getLLMConfigs();
      // Mask apiKeys for security
      const maskedConfigs = configs.map(c => ({
        ...c,
        apiKey: c.apiKey ? '********' : ''
      }));
      return { success: true, data: maskedConfigs };
    } catch (error) {
      log.error('Error getting LLM configs:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get current LLM config
  ipcMain.handle('llm:getCurrent', async () => {
    try {
      log.info('Getting current LLM config');
      const config = getCurrentLLMConfig();
      if (config?.apiKey) {
        config.apiKey = '********';
      }
      return { success: true, data: config };
    } catch (error) {
      log.error('Error getting current LLM config:', error);
      return { success: false, error: String(error) };
    }
  });

  // Set current LLM config
  ipcMain.handle('llm:setCurrent', async (_event, id: string) => {
    try {
      log.info('Setting current LLM config:', id);
      setCurrentLLMConfigId(id);
      return { success: true };
    } catch (error) {
      log.error('Error setting current LLM config:', error);
      return { success: false, error: String(error) };
    }
  });

  // Add LLM config
  ipcMain.handle('llm:add', async (_event, config: Omit<LLMConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      log.info('Adding LLM config:', config.name);
      const newConfig = addLLMConfig(config);
      if (newConfig.apiKey) {
        newConfig.apiKey = '********';
      }
      return { success: true, data: newConfig };
    } catch (error) {
      log.error('Error adding LLM config:', error);
      return { success: false, error: String(error) };
    }
  });

  // Update LLM config
  ipcMain.handle('llm:update', async (_event, id: string, updates: Partial<LLMConfig>) => {
    try {
      log.info('Updating LLM config:', id);
      const updated = updateLLMConfig(id, updates);
      if (updated?.apiKey) {
        updated.apiKey = '********';
      }
      return { success: true, data: updated };
    } catch (error) {
      log.error('Error updating LLM config:', error);
      return { success: false, error: String(error) };
    }
  });

  // Delete LLM config
  ipcMain.handle('llm:delete', async (_event, id: string) => {
    try {
      log.info('Deleting LLM config:', id);
      const success = deleteLLMConfig(id);
      return { success };
    } catch (error) {
      log.error('Error deleting LLM config:', error);
      return { success: false, error: String(error) };
    }
  });

  // Send chat message
  ipcMain.handle('llm:chat', async (_event, { messages, sessionId }: { messages: Message[]; sessionId: string }) => {
    try {
      log.info('LLM chat request, session:', sessionId);

      // Get current config and use it
      const config = getCurrentLLMConfig();
      if (!config) {
        return { success: false, error: 'LLM not configured. Please set up your LLM configuration first.' };
      }

      // Get response from LLM using the current config
      const response = await llmGateway.chatWithConfig(messages, config);

      return response;
    } catch (error) {
      log.error('Error in LLM chat:', error);
      return { success: false, error: String(error) };
    }
  });

  // Test LLM connection with provided config
  ipcMain.handle('llm:testConnection', async (_event, config: LLMConfig) => {
    try {
      log.info('Testing LLM connection for provider:', config.provider);
      const response = await llmGateway.testConnection(config);
      return response;
    } catch (error) {
      log.error('Error testing LLM connection:', error);
      return { success: false, error: String(error) };
    }
  });

  log.info('LLM IPC handlers registered');
}
