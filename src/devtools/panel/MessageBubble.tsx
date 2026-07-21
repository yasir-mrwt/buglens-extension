import React from 'react';

export interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  streaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, timestamp, streaming = false }) => {
  const bubbleRole = role === 'user' ? 'user' : 'assistant';
  const label = role === 'user' ? 'Tester' : role === 'system' ? 'System' : 'TestPilot AI';

  // Simple markdown-like formatter for basic bold, code blocks, and line breaks
  const renderFormattedContent = (text: string) => {
    if (!text) return null;

    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).trim();
        // Extract language if specified
        const firstNewline = code.indexOf('\n');
        const language = firstNewline !== -1 ? code.substring(0, firstNewline).trim() : '';
        const codeContent = firstNewline !== -1 ? code.substring(firstNewline + 1) : code;

        return (
          <pre key={index} className="testpilot-code-block">
            {language && <div className="code-lang">{language}</div>}
            <code>{codeContent}</code>
          </pre>
        );
      }

      // Handle inline code, bold, and line breaks
      const inlineParts = part.split(/(`[^`\n]+`|\*\*[^*]+\*\*)/g);
      return (
        <span key={index}>
          {inlineParts.map((subPart, subIndex) => {
            if (subPart.startsWith('`') && subPart.endsWith('`')) {
              return <code key={subIndex} className="testpilot-inline-code">{subPart.slice(1, -1)}</code>;
            }
            if (subPart.startsWith('**') && subPart.endsWith('**')) {
              return <strong key={subIndex}>{subPart.slice(2, -2)}</strong>;
            }
            // Handle line breaks
            return subPart.split('\n').map((line, lineIndex, array) => (
              <React.Fragment key={lineIndex}>
                {line}
                {lineIndex < array.length - 1 && <br />}
              </React.Fragment>
            ));
          })}
        </span>
      );
    });
  };

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <article className={`ai-chat-message ${bubbleRole}${streaming ? ' thinking' : ''}`}>
      <span>{label}</span>
      <div className="ai-chat-message-body">
        {renderFormattedContent(content)}
      </div>
      {formattedTime && <span className="message-time">{formattedTime}</span>}
    </article>
  );
};
