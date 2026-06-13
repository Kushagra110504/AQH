import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Gauge, Counter } from 'prom-client';
import { SessionStatus } from '@vsp/shared';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class AdminService implements OnModuleInit {
  private registry: Registry;
  private activeSessionsGauge: Gauge<string>;
  private activeParticipantsGauge: Gauge<string>;
  private errorsCounter: Counter<string>;

  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {
    this.registry = new Registry();

    this.activeSessionsGauge = new Gauge({
      name: 'vsp_active_sessions_count',
      help: 'Number of active support call sessions',
      registers: [this.registry],
    });

    this.activeParticipantsGauge = new Gauge({
      name: 'vsp_active_participants_count',
      help: 'Number of participants currently connected in support call sessions',
      registers: [this.registry],
    });

    this.errorsCounter = new Counter({
      name: 'vsp_errors_total',
      help: 'Total number of system/API errors logged',
      labelNames: ['type'],
      registers: [this.registry],
    });
  }

  async onModuleInit() {
    // Run background metrics update loop
    setInterval(() => this.updatePrometheusMetrics(), 10000);
  }

  private async updatePrometheusMetrics() {
    try {
      const activeSessions = await this.prisma.session.count({
        where: { status: SessionStatus.ACTIVE },
      });
      const activeParticipants = await this.prisma.participant.count({
        where: { leftAt: null },
      });

      this.activeSessionsGauge.set(activeSessions);
      this.activeParticipantsGauge.set(activeParticipants);
    } catch (err) {
      // Avoid failing if DB is busy
    }
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  async getAdminDashboardMetrics() {
    const activeSessionsCount = await this.prisma.session.count({
      where: { status: SessionStatus.ACTIVE },
    });

    const activeParticipantsCount = await this.prisma.participant.count({
      where: { leftAt: null },
    });

    const totalSessions = await this.prisma.session.count();

    const memUsage = process.memoryUsage();
    const cpuLoad = os.loadavg()[0]; // 1-minute load average

    return {
      activeSessions: activeSessionsCount,
      activeParticipants: activeParticipantsCount,
      totalSessions,
      systemMetrics: {
        cpuUsagePercent: Math.round(cpuLoad * 100) / 100,
        memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
        freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
      },
    };
  }

  async getActiveSessionsList() {
    return this.prisma.session.findMany({
      where: { status: SessionStatus.ACTIVE },
      include: {
        participants: {
          where: { leftAt: null },
        },
        createdBy: {
          select: { email: true },
        },
      },
    });
  }

  async forceTerminateSession(sessionId: string, adminId: string) {
    // Update DB
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ENDED },
    });

    // Mark current active participants as left
    const now = new Date();
    const activeParticipants = await this.prisma.participant.findMany({
      where: { sessionId, leftAt: null },
    });

    for (const participant of activeParticipants) {
      const duration = Math.round((now.getTime() - participant.joinedAt.getTime()) / 1000);
      await this.prisma.participant.update({
        where: { id: participant.id },
        data: { leftAt: now, durationSec: duration },
      });
    }

    // Force disconnect Socket.IO connections
    this.realtimeGateway.sendSessionEnded(sessionId);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'FORCE_TERMINATE_SESSION',
        metadata: JSON.stringify({ sessionId }),
      },
    });

    return { message: 'Session terminated successfully.' };
  }

  incrementErrorMetric(type: string) {
    this.errorsCounter.inc({ type });
  }
}
