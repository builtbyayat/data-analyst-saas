export interface PostgresPoolConfig {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

function readPositiveInt(
  source: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  max: number,
): number {
  const parsed = Number.parseInt(
    source[key] ?? String(fallback),
    10,
  );

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function getPostgresPoolConfig(
  source: NodeJS.ProcessEnv = process.env,
): PostgresPoolConfig {
  return {
    max: readPositiveInt(
      source,
      'DATABASE_POOL_MAX',
      20,
      100,
    ),
    idleTimeoutMillis: readPositiveInt(
      source,
      'DATABASE_POOL_IDLE_TIMEOUT_MS',
      30_000,
      300_000,
    ),
    connectionTimeoutMillis: readPositiveInt(
      source,
      'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
      5_000,
      60_000,
    ),
  };
}
