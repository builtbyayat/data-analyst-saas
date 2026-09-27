import {
  Controller,
  Get,
  HttpCode,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @HttpCode(200)
  async check() {
    const status =
      await this.healthService.check();

    if (status.status !== 'ok') {
      throw new ServiceUnavailableException(
        status,
      );
    }

    return status;
  }
}
