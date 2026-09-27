import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

type SecurityAuditValue =
  | string
  | number
  | boolean
  | null
  | undefined;

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(
    SecurityAuditService.name,
  );

  record(
    event: string,
    details: Record<string, SecurityAuditValue> = {},
  ): void {
    const sanitized = Object.fromEntries(
      Object.entries(details).map(([key, value]) => [
        key,
        typeof value === 'string' &&
        ['ip', 'email'].includes(key)
          ? this.fingerprint(value)
          : value,
      ]),
    );

    this.logger.warn(
      JSON.stringify({
        event,
        ...sanitized,
      }),
    );
  }

  private fingerprint(value: string): string {
    return createHash('sha256')
      .update(value)
      .digest('hex')
      .slice(0, 16);
  }
}
