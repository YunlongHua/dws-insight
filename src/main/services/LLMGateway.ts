import log from 'electron-log';
import { Message, LLMConfig } from '../storage/config';

// Re-export Message for backward compatibility with other modules
export { Message };

export interface LLMResponse {
  success: boolean;
  content?: string;
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

interface EIMaaSResponse {
  result?: {
    content?: string;
  };
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  content?: string;
}

export const llmGateway = {
  async chat(messages: Message[]): Promise<LLMResponse> {
    const { getLLMConfig } = await import('../storage/config');
    const config = getLLMConfig();

    if (!config) {
      return { success: false, error: 'LLM not configured. Please set up your LLM configuration first.' };
    }

    switch (config.provider) {
      case 'openai':
        return this.chatWithOpenAI(messages, config);
      case 'eimaas':
        return this.chatWithEIMaaS(messages, config);
      case 'custom':
        return this.chatWithCustom(messages, config);
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

      const data = await response.json() as OpenAIResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return { success: false, error: 'No content in response' };
      }

      return { success: true, content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('OpenAI chat error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  async chatWithEIMaaS(messages: Message[], config: LLMConfig): Promise<LLMResponse> {
    try {
      const baseUrl = config.baseUrl || 'https://ei-maas.example.com';

      // Huawei cloud EI-MaaS API format
      const response = await fetch(`${baseUrl}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': config.apiKey || '',
        },
        body: JSON.stringify({
          messages,
          model: config.model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        log.error('EI-MaaS API error:', response.status, errorData);
        return { success: false, error: `EI-MaaS API error: ${response.status} - ${errorData}` };
      }

      const data = await response.json() as EIMaaSResponse;
      const content = data.result?.content || data.choices?.[0]?.message?.content || data.content;

      if (!content) {
        return { success: false, error: 'No content in response' };
      }

      return { success: true, content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('EI-MaaS chat error:', errorMessage);
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

      const data = await response.json() as OpenAIResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return { success: false, error: 'No content in response' };
      }

      return { success: true, content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Custom chat error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },
};

export default llmGateway;
