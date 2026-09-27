import { Injectable } from '@nestjs/common';
import { sanitizeLogValue } from './log-sanitizer.js';

@Injectable()
export class StructuredLoggerService {
  log(
    ...args: unknown[]
  ): void {
    this.write('info', args);
  }

  error(
    ...args: unknown[]
  ): void {
    this.write('error', args);
  }

  warn(
    ...args: unknown[]
  ): void {
    this.write('warn', args);
  }

  debug(
    ...args: unknown[]
  ): void {
    if (
      process.env.LOG_LEVEL === 'debug'
    ) {
      this.write('debug', args);
    }
  }

  verbose(
    ...args: unknown[]
  ): void {
    if (
      process.env.LOG_LEVEL === 'verbose' ||
      process.env.LOG_LEVEL === 'debug'
    ) {
      this.write('verbose', args);
    }
  }

  fatal(
    ...args: unknown[]
  ): void {
    this.write('fatal', args);
  }

  private write(
    level: string,
    args: unknown[],
  ): void {
    const sanitized = args.map((value) =>
      sanitizeLogValue(value),
    );

    const [message, ...rest] = sanitized;

    const payload = {
      timestamp:
        new Date().toISOString(),
      level,
      message:
        typeof message === 'string'
          ? message
          : JSON.stringify(message),
      context:
        rest.length === 0
          ? undefined
          : rest.length === 1
            ? rest[0]
            : rest,
    };

    const serialized = JSON.stringify(
      payload,
    );

    if (level === 'error' || level === 'fatal') {
      process.stderr.write(
        `${serialized}\n`,
      );
      return;
    }

    process.stdout.write(
      `${serialized}\n`,
    );
  }
}
