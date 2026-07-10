export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingType = 'api' | 'console' | 'ui' | 'noise';
export type FindingCategory = 'actionable' | 'needs-review' | 'framework-noise' | 'informational' | 'passed';

export type NetworkEvent = {
  url: string;
  method?: string;
  status?: number | null;
  durationMs?: number | null;
  timestamp?: number;
};

export type ConsoleEvent = {
  channel?: string;
  level?: 'error' | 'warn' | 'info' | string;
  message: string;
  url?: string;
  timestamp?: number;
};

export type UiScanResult = {
  findings?: unknown[];
  scannedElements?: number;
  skippedElements?: number;
  viewport?: {
    width?: number;
    height?: number;
  };
};

export type IssueFinding = {
  id?: string;
  type: FindingType | string;
  title?: string;
  severity?: Severity | string;
  category?: FindingCategory | string;
  evidence?: unknown;
};

export type AiProviderSettings = {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  modelMode?: 'auto' | 'custom' | string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  status?: 'live' | 'checking' | 'offline' | 'model_error' | 'not_configured' | string;
  lastCheckedAt?: number | null;
  lastError?: string;
  usage?: unknown;
};

export type AgentCommandResult = {
  command?: string;
  taskType?: string;
  status?: string;
  summary?: string;
  actionResults?: unknown[];
  result?: unknown;
};
