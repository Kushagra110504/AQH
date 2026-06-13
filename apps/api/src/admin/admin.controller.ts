import { Controller, Get, Post, Param, UseGuards, Request, Header } from '@nestjs/common';
import { Role } from '@vsp/shared';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // Plaintext metrics for Prometheus scraping (public or IP-restricted; public for compose setup)
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics() {
    return this.adminService.getMetricsText();
  }

  @Get('dashboard-metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getDashboardMetrics() {
    return this.adminService.getAdminDashboardMetrics();
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getActiveSessions() {
    return this.adminService.getActiveSessionsList();
  }

  @Post('sessions/:id/terminate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async terminateSession(@Param('id') sessionId: string, @Request() req: any) {
    return this.adminService.forceTerminateSession(sessionId, req.user.id);
  }
}
