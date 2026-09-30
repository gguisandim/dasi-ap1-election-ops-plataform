import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'election-ops-api',
      timestamp: new Date().toISOString()
    };
  }
}
