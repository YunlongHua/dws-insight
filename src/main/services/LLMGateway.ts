import log from 'electron-log';
import { Message, LLMConfig } from '../storage/config';

// Re-export Message for backward compatibility with other modules
export { Message };

export interface LLMResponse {
  success: boolean;
  content?: string;
  think?: string;
  error?: string;
}

// API response type interfaces
interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export const llmGateway = {
  async chat(messages: Message[]): Promise<LLMResponse> {
    const { getCurrentLLMConfig } = await import('../storage/config');
    const config = getCurrentLLMConfig();

    if (!config) {
      return { success: false, error: 'LLM not configured. Please set up your LLM configuration first.' };
    }

    return this.chatWithConfig(messages, config);
  },

  async chatWithConfig(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
    switch (config.provider) {
      case 'openai':
        return this.chatWithOpenAI(messages, config);
      case 'custom':
        return this.chatWithCustom(messages, config);
      default:
        return { success: false, error: `Unknown provider: ${config.provider}` };
    }
  },

  async testConnection(config: LLMConfig): Promise<LLMResponse> {
    if (!config.baseUrl) {
      return { success: false, error: '请输入 API 地址' };
    }

    switch (config.provider) {
      case 'openai':
        return this.chatWithOpenAI([{ role: 'user', content: 'Hi' }], config);
      case 'custom':
        return this.chatWithCustom([{ role: 'user', content: 'Hi' }], config);
      default:
        return { success: false, error: `Unknown provider: ${config.provider}` };
    }
  },

  async chatWithOpenAI(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const baseUrl = config.baseUrl || 'https://api.openai.com';
      const model = config.model || 'gpt-4';

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        log.error('OpenAI API error:', response.status, errorData);
        return { success: false, error: `OpenAI API error: ${response.status} - ${errorData}` };
      }

      const data = await response.json() as OpenAIResponse & { think?: string };
      const content = data.choices?.[0]?.message?.content;
      const think = data.think;

      if (!content) {
        return { success: false, error: 'No content in response' };
      }

      return { success: true, content, think };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('OpenAI chat error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  async chatWithCustom(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const baseUrl = config.baseUrl;

      if (!baseUrl) {
        return { success: false, error: 'Custom provider requires a base URL' };
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        log.error('Custom API error:', response.status, errorData);
        return { success: false, error: `Custom API error: ${response.status} - ${errorData}` };
      }

      const data = await response.json() as OpenAIResponse & { think?: string };
      const content = data.choices?.[0]?.message?.content;
      const think = data.think;

      if (!content) {
        return { success: false, error: 'No content in response' };
      }

      return { success: true, content, think };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Custom chat error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },
};

export default llmGateway;
