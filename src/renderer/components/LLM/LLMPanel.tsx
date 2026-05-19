import React, { useState, useEffect } from 'react';

interface LLMConfig {
  provider: 'openai' | 'eimaas' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface LLMPanelProps {
  onConfigSaved?: () => void;
}

function LLMPanel({ onConfigSaved }: LLMPanelProps): React.ReactElement {
  const [provider, setProvider] = useState<'openai' | 'eimaas' | 'custom'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await window.electronAPI.llmGetConfig();
      if (response.success && response.data) {
        const config = response.data as LLMConfig;
        setProvider(config.provider || 'openai');
        setApiKey(config.apiKey || '');
        setBaseUrl(config.baseUrl || '');
        setModel(config.model || '');
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const config = {
        provider,
        apiKey,
        baseUrl,
        model,
      };

      const response = await window.electronAPI.llmSetConfig(config);

      if (response.success) {
        setSuccess('Configuration saved successfully');
        onConfigSaved?.();
      } else {
        setError(response.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const getProviderPlaceholder = () => {
    switch (provider) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'eimaas':
        return 'https://ei-maas.example.com';
      case 'custom':
        return 'https://your-custom-api.com';
      default:
        return '';
    }
  };

  const getDefaultModel = () => {
    switch (provider) {
      case 'openai':
        return 'gpt-4';
      case 'eimaas':
        return '';
      case 'custom':
        return '';
      default:
        return '';
    }
  };

  return (
    <div className="llm-panel">
      <h2>LLM Configuration</h2>
      <p className="subtitle">Configure your LLM provider settings</p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="form-group">
        <label htmlFor="provider">Provider</label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as 'openai' | 'eimaas' | 'custom');
            if (e.target.value === 'openai' && !model) {
              setModel('gpt-4');
            }
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="eimaas">Huawei EI-MaaS</option>
          <option value="custom">Custom API</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="apiKey">API Key</label>
        <input
          type="password"
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
        />
      </div>

      <div className="form-group">
        <label htmlFor="baseUrl">Base URL</label>
        <input
          type="text"
          id="baseUrl"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={getProviderPlaceholder()}
        />
        {provider === 'openai' && (
          <small className="hint">Leave empty to use OpenAI default</small>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="model">Model</label>
        <input
          type="text"
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={getDefaultModel() || 'Enter model name'}
        />
        {provider === 'openai' && (
          <small className="hint">Leave empty to use gpt-4</small>
        )}
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

export default LLMPanel;
