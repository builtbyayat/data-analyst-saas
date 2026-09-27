const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|api[-_]?key|key_secret|access_token|refresh_token)/i;
function sanitizeString(value: string): string {
  const normalized = value.trim();

  if (/^Bearer\s+[^\s]+$/i.test(normalized)) {
    return '[REDACTED]';
  }

  return value.length > 4000
    ? `${value.slice(0, 4000)}…`
    : value;
}

export function sanitizeLogValue(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 4) {
    return '[TRUNCATED]';
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack:
        value.stack
          ? sanitizeString(value.stack)
          : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) =>
        sanitizeLogValue(item, depth + 1),
      );
  }

  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : sanitizeLogValue(
          child,
          depth + 1,
        );
  }

  return result;
}
