import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  ChildProcessWithoutNullStreams,
  spawn,
} from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';

interface PythonWorkerResponse {
  requestId: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export interface PythonAnalyticsRequest {
  operation?: string;
  question?: string;
  columns?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
  args?: Record<string, unknown>;
}

export interface PythonAnalyticsResult {
  requestId: string;
  result: unknown;
}

@Injectable()
export class PythonAnalyticsService
  implements OnModuleDestroy
{
  private readonly logger = new Logger(
    PythonAnalyticsService.name,
  );

  private readonly pythonExecutable =
    this.resolvePythonExecutable();

  private readonly workerPath =
    this.resolveWorkerPath();

  private readonly timeoutMs =
    this.parsePositiveInt(
      process.env.PYTHON_ANALYTICS_TIMEOUT_MS,
      120_000,
    );

  private readonly maxRequestBytes =
    this.parsePositiveInt(
      process.env.PYTHON_ANALYTICS_MAX_REQUEST_BYTES,
      1_000_000,
    );

  private readonly maxResponseBytes =
    this.parsePositiveInt(
      process.env.PYTHON_ANALYTICS_MAX_RESPONSE_BYTES,
      5_000_000,
    );

  private readonly maxRows =
    this.parsePositiveInt(
      process.env.PYTHON_ANALYTICS_MAX_ROWS,
      500_000,
    );

  private readonly maxColumns =
    this.parsePositiveInt(
      process.env.PYTHON_ANALYTICS_MAX_COLUMNS,
      200,
    );

  private readonly activeWorkers =
    new Set<ChildProcessWithoutNullStreams>();

  async ping(): Promise<unknown> {
    const response =
      await this.execute({
        operation: 'ping',
      });

    return response.result;
  }

  async getOperations(): Promise<unknown> {
    const response =
      await this.execute({
        operation: 'operations',
      });

    return response.result;
  }

  async analyze(
    rows: Array<Record<string, unknown>>,
    operation: string,
    args: Record<string, unknown> = {},
  ): Promise<PythonAnalyticsResult> {
    this.validateRows(rows);

    if (!operation.trim()) {
      throw new Error(
        'Python analytics operation is required.',
      );
    }

    return this.execute({
      operation,
      rows,
      args,
    });
  }

  /**
   * Planner-aware analytics entry point.
   *
   * The Python worker receives the natural-language question,
   * dataset column metadata, and validated result rows.
   *
   * The Python side decides which analytics operations are
   * required and returns their structured results.
   */
  async analyzeQuestion(
    rows: Array<Record<string, unknown>>,
    columns: Array<Record<string, unknown>>,
    question: string,
  ): Promise<PythonAnalyticsResult> {
    this.validateRows(rows);
    this.validateColumns(columns);

    const normalizedQuestion =
      question.trim();

    if (!normalizedQuestion) {
      throw new Error(
        'Analytics question is required.',
      );
    }

    return this.execute({
      question:
        normalizedQuestion,

      columns,

      rows,
    });
  }

  private resolvePythonExecutable(): string {
    const configured =
      process.env.PYTHON_ANALYTICS_PYTHON?.trim();

    if (configured) {
      return configured;
    }

    const virtualEnvironmentExecutable =
      process.platform === 'win32'
        ? resolve(
            process.cwd(),
            'python-engine',
            '.venv',
            'Scripts',
            'python.exe',
          )
        : resolve(
            process.cwd(),
            'python-engine',
            '.venv',
            'bin',
            'python',
          );

    if (
      existsSync(
        virtualEnvironmentExecutable,
      )
    ) {
      return virtualEnvironmentExecutable;
    }

    return process.platform === 'win32'
      ? 'python'
      : 'python3';
  }

  private resolveWorkerPath(): string {
    const configured =
      process.env.PYTHON_ANALYTICS_WORKER_PATH?.trim() ||
      process.env.PYTHON_ANALYTICS_WORKER?.trim();

    if (configured) {
      return resolve(configured);
    }

    return resolve(
      process.cwd(),
      'python-engine',
      'worker.py',
    );
  }

  private async execute(
    request: PythonAnalyticsRequest,
  ): Promise<PythonAnalyticsResult> {
    const requestId =
      randomUUID();

    const payload =
      JSON.stringify({
        requestId,
        ...request,
      });

    const payloadBytes =
      Buffer.byteLength(
        payload,
        'utf8',
      );

    if (
      payloadBytes >
      this.maxRequestBytes
    ) {
      throw new Error(
        `Python analytics request exceeds the ${this.maxRequestBytes} byte limit.`,
      );
    }

    return new Promise<PythonAnalyticsResult>(
      (
        resolveRequest,
        rejectRequest,
      ) => {
        let settled = false;
        let responseBytes = 0;
        let stderr = '';

        const worker =
          spawn(
            this.pythonExecutable,
            [this.workerPath],
            {
              cwd: resolve(
                this.workerPath,
                '..',
              ),

              env: process.env,

              windowsHide: true,

              stdio: [
                'pipe',
                'pipe',
                'pipe',
              ],
            },
          );

        this.activeWorkers.add(
          worker,
        );

        const cleanup = () => {
          this.activeWorkers.delete(
            worker,
          );
        };

        const settleError = (
          error: Error,
        ) => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup();

          try {
            if (!worker.killed) {
              worker.kill();
            }
          } catch {
            // Ignore process shutdown races.
          }

          rejectRequest(error);
        };

        const settleSuccess = (
          result: PythonAnalyticsResult,
        ) => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup();

          resolveRequest(
            result,
          );
        };

        const timeout =
          setTimeout(
            () => {
              settleError(
                new Error(
                  `Python analytics worker timed out after ${this.timeoutMs}ms.`,
                ),
              );
            },
            this.timeoutMs,
          );

        const finish = () => {
          clearTimeout(
            timeout,
          );
        };

        const readline =
          createInterface({
            input:
              worker.stdout,

            crlfDelay:
              Infinity,
          });

        readline.on(
          'line',
          (line: string) => {
            if (settled) {
              return;
            }

            responseBytes +=
              Buffer.byteLength(
                line,
                'utf8',
              );

            if (
              responseBytes >
              this.maxResponseBytes
            ) {
              finish();

              settleError(
                new Error(
                  `Python analytics response exceeds the ${this.maxResponseBytes} byte limit.`,
                ),
              );

              return;
            }

            const trimmed =
              line.trim();

            if (!trimmed) {
              return;
            }

            let response:
              | PythonWorkerResponse
              | undefined;

            try {
              response =
                JSON.parse(
                  trimmed,
                ) as PythonWorkerResponse;
            } catch {
              finish();

              settleError(
                new Error(
                  'Python analytics worker returned invalid JSON.',
                ),
              );

              return;
            }

            if (
              response.requestId !==
              requestId
            ) {
              return;
            }

            finish();

            if (
              response.status ===
              'success'
            ) {
              settleSuccess({
                requestId,

                result:
                  response.result,
              });

              return;
            }

            const code =
              response.error?.code;

            const message =
              response.error?.message ||
              'Python analytics worker failed.';

            const suffix =
              code
                ? ` [${code}]`
                : '';

            settleError(
              new Error(
                `${message}${suffix}`,
              ),
            );
          },
        );

        worker.stderr.on(
          'data',
          (chunk: Buffer) => {
            if (
              stderr.length >=
              8_000
            ) {
              return;
            }

            stderr +=
              chunk
                .toString(
                  'utf8',
                )
                .slice(
                  0,
                  8_000 -
                    stderr.length,
                );
          },
        );

        worker.on(
          'error',
          (error: Error) => {
            finish();

            settleError(
              new Error(
                `Unable to start Python analytics worker: ${error.message}`,
              ),
            );
          },
        );

        worker.on(
          'close',
          (
            code,
            signal,
          ) => {
            finish();

            if (settled) {
              return;
            }

            const diagnostics =
              stderr.trim();

            const suffix =
              diagnostics
                ? ` ${diagnostics}`
                : '';

            settleError(
              new Error(
                `Python analytics worker exited unexpectedly (code=${code}, signal=${signal}).${suffix}`,
              ),
            );
          },
        );

        try {
          worker.stdin.write(
            `${payload}\n`,
            'utf8',
          );

          worker.stdin.end();
        } catch (error) {
          finish();

          settleError(
            error instanceof Error
              ? error
              : new Error(
                  'Failed to send request to Python analytics worker.',
                ),
          );
        }
      },
    );
  }

  private validateRows(
    rows: Array<Record<string, unknown>>,
  ): void {
    if (!Array.isArray(rows)) {
      throw new Error(
        'Python analytics rows must be an array.',
      );
    }

    if (
      rows.length >
      this.maxRows
    ) {
      throw new Error(
        `Python analytics input exceeds the ${this.maxRows} row limit.`,
      );
    }
  }

  private validateColumns(
    columns: Array<Record<string, unknown>>,
  ): void {
    if (!Array.isArray(columns)) {
      throw new Error(
        'Python analytics columns must be an array.',
      );
    }

    if (
      columns.length >
      this.maxColumns
    ) {
      throw new Error(
        `Python analytics input exceeds the ${this.maxColumns} column limit.`,
      );
    }
  }

  private parsePositiveInt(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsed =
      Number(value);

    if (
      !Number.isFinite(
        parsed,
      ) ||
      parsed <= 0
    ) {
      return fallback;
    }

    return Math.floor(
      parsed,
    );
  }

  onModuleDestroy(): void {
    for (
      const worker of
        this.activeWorkers
    ) {
      try {
        if (!worker.killed) {
          worker.kill();
        }
      } catch {
        // Ignore shutdown races.
      }
    }

    this.activeWorkers.clear();
  }
}