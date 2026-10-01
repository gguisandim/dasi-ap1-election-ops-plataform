import { Controller, Get } from '@nestjs/common';
import { Public } from '../../../plugins/system/access-control/src/server/auth.decorators';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  health() {
    return {
      status: 'ok',
      service: 'election-ops-api',
      timestamp: new Date().toISOString()
    };
  }
}
