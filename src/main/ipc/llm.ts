import { ipcMain } from 'electron';
import log from 'electron-log';
import { getLLMConfig, setLLMConfig, LLMConfig } from '../storage/config';
import { saveMessage, getMessages } from '../storage/database';
import { llmGateway, Message } from '../services/LLMGateway';

export function registerLLMIPC(): void {
  // Get LLM configuration
  ipcMain.handle('llm:getConfig', async () => {
    try {
      log.info('Getting LLM config');
      const config = getLLMConfig();
      // Don't expose the full apiKey for security
      if (config?.apiKey) {
        config.apiKey = '********';
      }
      return { success: true, data: config };
    } catch (error) {
      log.error('Error getting LLM config:', error);
      return { success: false, error: String(error) };
    }
  });

  // Set LLM configuration
  ipcMain.handle('llm:setConfig', async (_event, config: Omit<LLMConfig, 'createdAt' | 'updatedAt'>) => {
    try {
      log.info('Setting LLM config for provider:', config.provider);
      const savedConfig = setLLMConfig(config);
      // Mask apiKey in response
      if (savedConfig.apiKey) {
        savedConfig.apiKey = '********';
      }
      return { success: true, data: savedConfig };
    } catch (error) {
      log.error('Error setting LLM config:', error);
      return { success: false, error: String(error) };
    }
  });

  // Send chat message
  ipcMain.handle('llm:chat', async (_event, { messages, sessionId }: { messages: Message[]; sessionId: string }) => {
    try {
      log.info('LLM chat request, session:', sessionId);

      // Save user messages to database
      for (const message of messages) {
        if (message.role === 'user') {
          saveMessage({ session_id: sessionId, role: message.role, content: message.content });
        }
      }

      // Get response from LLM
      const response = await llmGateway.chat(messages);

      if (response.success && response.content) {
        // Save assistant response to database
        saveMessage({ session_id: sessionId, role: 'assistant', content: response.content });
      }

      return response;
    } catch (error) {
      log.error('Error in LLM chat:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get chat history
  ipcMain.handle('llm:getMessages', async (_event, sessionId: string) => {
    try {
      log.info('Getting messages for session:', sessionId);
      const messages = getMessages(sessionId);
      return { success: true, data: messages };
    } catch (error) {
      log.error('Error getting messages:', error);
      return { success: false, error: String(error) };
    }
  });

  log.info('LLM IPC handlers registered');
}
