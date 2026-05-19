import React, { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatPanelProps {
  sessionId?: string;
}

function ChatPanel({ sessionId = 'default' }: ChatPanelProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadMessages();
  }, [sessionId]);

  const loadMessages = async () => {
    try {
      const response = await window.electronAPI.llmGetMessages(sessionId);
      if (response.success && response.data) {
        setMessages(response.data.map((msg: { role: string; content: string }) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })));
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const allMessages = [...messages, userMessage];
      const response = await window.electronAPI.llmChat({
        messages: allMessages,
        sessionId,
      });

      if (response.success && response.content) {
        const assistantMessage: Message = { role: 'assistant', content: response.content };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setError(response.error || 'Failed to get response');
        // Remove the user message if the request failed
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (err) {
      setError(String(err));
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>Chat</h2>
        <button className="btn btn-secondary" onClick={clearChat}>
          Clear
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>No messages yet. Start a conversation below.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`chat-message chat-message-${message.role}`}
          >
            <div className="chat-message-avatar">
              {message.role === 'user' ? 'U' : 'A'}
            </div>
            <div className="chat-message-content">
              <div className="chat-message-text">{message.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-message-avatar">A</div>
            <div className="chat-message-content">
              <div className="chat-message-text typing">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={loading}
        />
        <button
          className="btn btn-primary chat-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
