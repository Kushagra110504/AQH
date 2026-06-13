import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccessToken } from 'livekit-server-sdk';
import { Role, SessionStatus } from '@vsp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class SessionsService {
  private livekitApiKey: string;
  private livekitApiSecret: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private jwtService: JwtService,
    private realtimeGateway: RealtimeGateway,
  ) {
    this.livekitApiKey = this.config.get<string>('LIVEKIT_API_KEY') || 'devkey';
    this.livekitApiSecret = this.config.get<string>('LIVEKIT_API_SECRET') || 'secret';
  }

  async createSession(agentId: string) {
    const session = await this.prisma.session.create({
      data: {
        status: SessionStatus.CREATED,
        createdById: agentId,
      },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: agentId,
        action: 'CREATE_SESSION',
        metadata: JSON.stringify({ sessionId: session.id }),
      },
    });

    return session;
  }

  async getSessions() {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }

  async getSessionById(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: 'asc' } },
        files: true,
        recordings: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    return session;
  }

  async joinAsAgent(sessionId: string, agent: { id: string; email: string; role: Role }) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    if (session.status === SessionStatus.ENDED) {
      throw new BadRequestException('Session has already ended.');
    }

    // Mark status as active if first join
    if (session.status === SessionStatus.CREATED) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { status: SessionStatus.ACTIVE },
      });
    }

    // Register participant
    const participant = await this.prisma.participant.create({
      data: {
        sessionId,
        userId: agent.id,
        role: agent.role,
      },
    });

    // LiveKit Token
    const livekitToken = await this.generateLivekitToken(sessionId, agent.id, agent.email);

    return {
      livekitToken,
      participantId: participant.id,
    };
  }

  async joinAsCustomer(inviteToken: string, name: string) {
    const session = await this.prisma.session.findUnique({
      where: { inviteToken },
    });

    if (!session) {
      throw new NotFoundException('Invalid session invite link.');
    }

    if (session.status === SessionStatus.ENDED) {
      throw new BadRequestException('This session has already ended.');
    }

    // Update session status if first join
    if (session.status === SessionStatus.CREATED) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.ACTIVE },
      });
    }

    // Create participant entry
    const participantId = `cust-${Math.random().toString(36).substring(2, 11)}`;
    const participant = await this.prisma.participant.create({
      data: {
        sessionId: session.id,
        role: Role.CUSTOMER,
      },
    });

    // Generate JWT access token for customer
    const jwtPayload = {
      sub: participant.id,
      email: `${name.replace(/\s+/g, '').toLowerCase()}@customer.vsp`,
      role: Role.CUSTOMER,
      sessionId: session.id,
    };

    const accessTokenSecret = this.config.get<string>('JWT_ACCESS_SECRET') || 'access-secret-key-12345';
    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: accessTokenSecret,
      expiresIn: '12h',
    });

    // Generate LiveKit token
    const livekitToken = await this.generateLivekitToken(session.id, participant.id, name);

    return {
      accessToken,
      livekitToken,
      participantId: participant.id,
      sessionId: session.id,
    };
  }

  async endSession(sessionId: string, actorId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ENDED },
    });

    // Write leave times for active participants
    const activeParticipants = await this.prisma.participant.findMany({
      where: { sessionId, leftAt: null },
    });

    const now = new Date();
    for (const participant of activeParticipants) {
      const duration = Math.round((now.getTime() - participant.joinedAt.getTime()) / 1000);
      await this.prisma.participant.update({
        where: { id: participant.id },
        data: { leftAt: now, durationSec: duration },
      });
    }

    // Trigger websocket room end and force disconnects
    this.realtimeGateway.sendSessionEnded(sessionId);

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId.startsWith('cust-') ? null : actorId,
        action: 'END_SESSION',
        metadata: JSON.stringify({ sessionId }),
      },
    });

    return updatedSession;
  }

  private async generateLivekitToken(roomName: string, identity: string, name: string): Promise<string> {
    const at = new AccessToken(this.livekitApiKey, this.livekitApiSecret, {
      identity,
      name,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return at.toJwt();
  }
}
