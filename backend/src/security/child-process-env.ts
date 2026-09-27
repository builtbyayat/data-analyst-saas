const SAFE_RUNTIME_KEYS = [
  'PATH',
  'Path',
  'PATHEXT',
  'SYSTEMROOT',
  'WINDIR',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'PYTHONPATH',
  'PYTHONUTF8',
  'PYTHONIOENCODING',
];

export function createPythonWorkerEnv(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};

  for (const key of SAFE_RUNTIME_KEYS) {
    const value = source[key];

    if (value !== undefined) {
      environment[key] = value;
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (
      value !== undefined &&
      (key.startsWith('PYTHON_ANALYTICS_') ||
        key.startsWith('ANALYTICS_'))
    ) {
      environment[key] = value;
    }
  }

  return environment;
}
