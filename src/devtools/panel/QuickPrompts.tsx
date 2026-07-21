import React from 'react';

export type QuickPrompt = {
  label: string;
  value: string;
};

export const defaultQuickPrompts: QuickPrompt[] = [
  { label: 'Summarize findings', value: 'Summarize the current findings and highlight the most important issues.' },
  { label: 'What should I test?', value: 'What should I test next on this page?' },
  { label: 'Draft a bug report', value: 'Draft a bug report from the most important actionable finding.' },
  { label: 'Explain console errors', value: 'Explain the console errors and whether they look user-impacting.' },
  { label: 'Check UI issues', value: 'Check the visible UI for issues I should verify manually.' }
];

export interface QuickPromptsProps {
  prompts?: QuickPrompt[];
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export const QuickPrompts: React.FC<QuickPromptsProps> = ({
  prompts = defaultQuickPrompts,
  onSelectPrompt,
  disabled = false
}) => {
  return (
    <section className="testpilot-quick-prompts" aria-label="Quick prompts">
      <span className="testpilot-quick-prompts-label">Quick prompts</span>
      <div className="testpilot-quick-prompts-chips">
        {prompts.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            className="testpilot-quick-prompt-chip"
            disabled={disabled}
            onClick={() => onSelectPrompt(prompt.value)}
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </section>
  );
};