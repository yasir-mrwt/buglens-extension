const REDACTION_KEYS = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'api_key', 'token', 'access_token', 'refresh_token', 'id_token', 'password', 'secret'];

function isSensitiveKey(key) {
  const normalized = String(key || '').toLowerCase();
  return REDACTION_KEYS.some((candidate) => normalized.includes(candidate));
}

function redactValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === 'object') {
    const output = {};
    for (const [k, v] of Object.entries(value)) {
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

exports.sanitizeCapturedMetadata = function sanitizeCapturedMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const output = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactValue(value);
    }
  }
  return output;
};
