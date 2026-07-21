import React from 'react';
import { MessageBubble } from './MessageBubble';
import { QuickPrompts } from './QuickPrompts';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

export interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  buildContext?: () => unknown;
  mode: 'chat' | 'agent';
  onModeChange: (mode: 'chat' | 'agent') => void;
  aiStatus: 'checking' | 'running' | 'error';
  onRetryConnection?: () => void;
  isStreaming?: boolean;
  backendUrl?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  buildContext,
  mode,
  onModeChange,
  aiStatus,
  onRetryConnection,
  isStreaming = false,
  backendUrl = 'http://localhost:8787',
}) => {
  const [input, setInput] = React.useState('');
  const [localMessages, setLocalMessages] = React.useState<Message[]>(messages);
  const [localStreaming, setLocalStreaming] = React.useState(false);
  const activeStreamRef = React.useRef<AbortController | null>(null);
  const isMountedRef = React.useRef(true);
  const messagesRef = React.useRef<Message[]>(messages);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const streamingActive = isStreaming || localStreaming;

  React.useEffect(() => {
    messagesRef.current = localMessages;
  }, [localMessages]);

  React.useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  React.useEffect(() => () => {
    isMountedRef.current = false;
    activeStreamRef.current?.abort();
  }, []);

  const updateMessage = React.useCallback((id: string, updater: (message: Message) => Message) => {
    setLocalMessages((current) => current.map((message) => (message.id === id ? updater(message) : message)));
  }, []);

  const appendAssistantToken = React.useCallback((id: string, token: string) => {
    if (!token) return;
    updateMessage(id, (message) => ({
      ...message,
      content: `${message.content || ''}${token}`
    }));
  }, [updateMessage]);

  const replaceAssistantMessage = React.useCallback((id: string, content: string) => {
    updateMessage(id, (message) => ({
      ...message,
      content,
      streaming: false
    }));
  }, [updateMessage]);

  const getChatHistory = React.useCallback((nextMessage: Message) => (
    [...messagesRef.current, nextMessage]
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-8)
      .map((message) => ({
        role: message.role,
        text: message.content
      }))
  ), []);

  const consumeSseEvent = React.useCallback((eventText: string, assistantId: string) => {
    const lines = String(eventText || '').split(/\r?\n/);
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }

    if (!dataLines.length) return null;

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      data = { text: dataLines.join('\n') };
    }

    if (eventName === 'token') {
      appendAssistantToken(assistantId, String(data.token || data.text || ''));
      return null;
    }

    if (eventName === 'replace') {
      replaceAssistantMessage(assistantId, String(data.answer || data.text || ''));
      return null;
    }

    if (eventName === 'error') {
      replaceAssistantMessage(assistantId, String(data.answer || data.error || 'Streaming failed.'));
      return data;
    }

    if (eventName === 'done') {
      replaceAssistantMessage(assistantId, String(data.answer || ''));
      return data;
    }

    return data;
  }, [appendAssistantToken, replaceAssistantMessage]);

  const streamAssistantReply = React.useCallback(async (content: string, assistantId: string, signal: AbortSignal) => {
    const response = await fetch(`${String(backendUrl || '').replace(/\/+$/, '')}/api/ai/chat-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      signal,
      body: JSON.stringify({
        message: content,
        mode: mode,
        context: buildContext?.() || {},
        history: getChatHistory({
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          timestamp: Date.now()
        })
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI backend returned ${response.status}: ${body.slice(0, 240)}`);
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      const payload = await response.json().catch(() => ({}));
      const answer = String((payload as { answer?: string; message?: string }).answer || (payload as { answer?: string; message?: string }).message || '').trim();
      replaceAssistantMessage(assistantId, answer || 'No response received.');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() || '';
      for (const part of parts) consumeSseEvent(part, assistantId);
      if (done) break;
    }

    if (buffer.trim()) consumeSseEvent(buffer, assistantId);
  }, [backendUrl, consumeSseEvent, getChatHistory, mode, replaceAssistantMessage]);

  const submitMessage = React.useCallback(async (content: string) => {
    if (!content || streamingActive) return;

    onSendMessage(content);
    setInput('');
    activeStreamRef.current?.abort();

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    const assistantId = `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setLocalMessages((current) => [
      ...current,
      userMessage,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true
      }
    ]);

    const controller = new AbortController();
    activeStreamRef.current = controller;
    setLocalStreaming(true);

    try {
      await streamAssistantReply(content, assistantId, controller.signal);
    } catch (error) {
      if (controller.signal.aborted || !isMountedRef.current) return;
      const reason = error instanceof Error ? error.message : 'Unknown streaming error';
      replaceAssistantMessage(assistantId, `Streaming failed. ${reason}`);
    } finally {
      if (isMountedRef.current) {
        updateMessage(assistantId, (message) => ({ ...message, streaming: false }));
        setLocalStreaming(false);
      }
      if (activeStreamRef.current === controller) activeStreamRef.current = null;
    }
  }, [isMountedRef, onSendMessage, replaceAssistantMessage, setInput, setLocalStreaming, streamAssistantReply, streamingActive, updateMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    await submitMessage(content);
  };

  const handleQuickPromptSelect = (prompt: string) => {
    if (streamingActive) return;
    setInput(prompt);
    textareaRef.current?.focus();
  };

  return (
    <section className="ai-panel ai-only testpilot-chat-panel">
      <article className="testpilot-chat-card">
        <header className="testpilot-chat-head">
          <div className="testpilot-chat-copy">
            <div className="testpilot-chat-title-row">
              <h1>AI QA Agent</h1>
              <div className="testpilot-mode-toggle" aria-label="Chat mode">
                <button
                  id="testPilotChatModeBtn"
                  className={mode === 'chat' ? 'active' : ''}
                  type="button"
                  onClick={() => onModeChange('chat')}
                >
                  Chat
                </button>
                <button
                  id="testPilotAgentModeBtn"
                  className={mode === 'agent' ? 'active' : ''}
                  type="button"
                  onClick={() => onModeChange('agent')}
                >
                  Agent
                </button>
              </div>
              <div className="testpilot-live-status" aria-live="polite">
                {aiStatus === 'error' ? (
                  <>
                    <span id="aiStatusPill" className="status-pill error">Ollama is not running</span>
                    <button
                      id="checkAiBtn"
                      className="testpilot-retry-ai"
                      type="button"
                      aria-label="Retry local AI connection"
                      onClick={onRetryConnection}
                    >
                      ↻
                    </button>
                  </>
                ) : (
                  <>
                    <span id="aiStatusPill" className={`status-pill ${aiStatus}`}>
                      {aiStatus === 'checking' ? 'Checking' : 'Running'}
                    </span>
                    <button
                      id="checkAiBtn"
                      className="testpilot-retry-ai hidden"
                      type="button"
                      aria-label="Retry local AI connection"
                      onClick={onRetryConnection}
                    >
                      ↻
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <div id="aiChatMessages" className="testpilot-chat-messages" aria-live="polite">
          {localMessages.length === 0 ? (
            <div className="testpilot-empty-chat">Tell TestPilot what to test on this page.</div>
          ) : (
            localMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                streaming={Boolean(msg.streaming)}
              />
            ))
          )}
        </div>

        <form id="aiChatForm" className="testpilot-composer" onSubmit={handleSubmit}>
          <QuickPrompts disabled={streamingActive} onSelectPrompt={handleQuickPromptSelect} />
          <div className="testpilot-composer-row">
            <textarea
              id="aiChatInput"
              ref={textareaRef}
              rows={2}
              placeholder="Ask about this QA session..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submitMessage(input.trim());
                }
              }}
            />
            <button id="sendAiChatBtn" className="primary testpilot-send" type="submit" aria-label="Send" disabled={streamingActive || (aiStatus === 'error' && !onRetryConnection)}>
              {streamingActive ? '…' : '➤'}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};
