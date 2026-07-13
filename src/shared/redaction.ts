export type RedactionRecord = Record<string, unknown>;

const REDACTION_KEYS = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'api_key', 'token', 'access_token', 'refresh_token', 'id_token', 'password', 'secret'];

function isSensitiveKey(key: string) {
  const normalized = String(key || '').toLowerCase();
  return REDACTION_KEYS.some((candidate) => normalized.includes(candidate));
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        output[k] = '[REDACTED]';
      } else {
        output[k] = redactValue(v);
      }
    }
    return output;
  }
  return value;
}

export function sanitizeCapturedMetadata(metadata: RedactionRecord | null | undefined) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = redactValue(value);
    } else {
      output[key] = redactValue(value);
    }
  }
  return output;
}
