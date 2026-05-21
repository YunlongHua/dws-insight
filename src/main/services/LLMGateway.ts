import log from 'electron-log';
import { Message, LLMConfig } from '../storage/config';

// Re-export Message for backward compatibility
export { Message };

export interface LLMResponse {
  success: boolean;
  content?: string;
  think?: string;
  error?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface LLMChatOptions {
  messages: Message[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
}

export interface ToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
}

// API response type interfaces
interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
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
        return this.chatWithOpenAI({ messages }, config);
      case 'custom':
        return this.chatWithCustom({ messages }, config);
      default:
        return { success: false, error: `Unknown provider: ${config.provider}` };
    }
  },

  async chatWithTools(options: LLMChatOptions, config: LLMConfig): Promise<LLMResponse> {
    switch (config.provider) {
      case 'openai':
        return this.chatWithOpenAI(options, config);
      case 'custom':
        return this.chatWithCustom(options, config);
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
        return this.chatWithOpenAI({ messages: [{ role: 'user', content: 'Hi' }] }, config);
      case 'custom':
        return this.chatWithCustom({ messages: [{ role: 'user', content: 'Hi' }] }, config);
      default:
        return { success: false, error: `Unknown provider: ${config.provider}` };
    }
  },

  async chatWithOpenAI(options: LLMChatOptions, config: LLMConfig): Promise<LLMResponse> {
    try {
      const baseUrl = config.baseUrl || 'https://api.openai.com';
      const model = config.model || 'gpt-4';

      const requestBody: any = {
        model,
        messages: options.messages,
      };

      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
        requestBody.tool_choice = 'auto';
      }

      if (options.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      if (options.maxTokens !== undefined) {
        requestBody.max_tokens = options.maxTokens;
      }

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        log.error('OpenAI API error:', response.status, errorData);
        return { success: false, error: `OpenAI API error: ${response.status} - ${errorData}` };
      }

      const data = await response.json() as OpenAIResponse & { think?: string };
      const message = data.choices?.[0]?.message;

      if (!message) {
        return { success: false, error: 'No response from LLM' };
      }

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Return tool calls info for client to handle
        const toolCalls = message.tool_calls.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }));
        return {
          success: true,
          content: JSON.stringify({ toolCalls }),
          think: data.think
        };
      }

      const content = message.content;
      if (!content) {
        return { success: false, error: 'No content in response' };
      }

      return { success: true, content, think: data.think };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('OpenAI chat error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },

  async chatWithCustom(options: LLMChatOptions, config: LLMConfig): Promise<LLMResponse> {
    try {
      const baseUrl = config.baseUrl;

      if (!baseUrl) {
        return { success: false, error: 'Custom provider requires a base URL' };
      }

      const requestBody: any = {
        model: config.model,
        messages: options.messages,
      };

      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        log.error('Custom API error:', response.status, errorData);
        return { success: false, error: `Custom API error: ${response.status} - ${errorData}` };
      }

      const data = await response.json() as OpenAIResponse & { think?: string };
      const message = data.choices?.[0]?.message;

      if (!message) {
        return { success: false, error: 'No response from LLM' };
      }

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCalls = message.tool_calls.map(tc => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }));
        return {
          success: true,
          content: JSON.stringify({ toolCalls }),
          think: data.think
        };
      }

      const content = message.content;
      if (!content) {
        return { success: false, error: 'No content in response' };
      }

      return { success: true, content, think: data.think };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Custom chat error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  },
};

export default llmGateway;
