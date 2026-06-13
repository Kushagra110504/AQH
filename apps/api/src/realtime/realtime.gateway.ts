import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, SocketEvents, JWTPayload } from '@vsp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.query?.token as string);

      if (!token) {
        socket.disconnect();
        return;
      }

      const secret = this.config.get<string>('JWT_ACCESS_SECRET') || 'access-secret-key-12345';
      const payload = this.jwtService.verify<JWTPayload>(token, { secret });
      
      socket.data.user = payload;
      console.log(`Socket connected: ${socket.id} (user: ${payload.email})`);
    } catch (err) {
      console.error(`Socket connection unauthorized: ${err.message}`);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data.user as JWTPayload & { sessionId?: string; participantId?: string };
    if (!user || !user.sessionId || !user.participantId) {
      console.log(`Socket disconnected: ${socket.id} (unregistered)`);
      return;
    }

    console.log(`Socket disconnected: ${socket.id} (user: ${user.email}, session: ${user.sessionId})`);

    const { sessionId, participantId } = user;
    const redisKey = `reconnect_pending:${sessionId}:${participantId}`;
    
    // Write grace window state in Redis for 60 seconds
    await this.redis.set(redisKey, socket.id, 60);

    // Schedule grace period check
    setTimeout(async () => {
      const stillPending = await this.redis.get(redisKey);
      if (stillPending === socket.id) {
        // Participant did not reconnect in time. Mark as left.
        await this.redis.del(redisKey);

        const participant = await this.prisma.participant.findUnique({
          where: { id: participantId },
        });

        if (participant && !participant.leftAt) {
          const now = new Date();
          const duration = Math.round((now.getTime() - participant.joinedAt.getTime()) / 1000);
          
          await this.prisma.participant.update({
            where: { id: participantId },
            data: { leftAt: now, durationSec: duration, socketId: null },
          });

          // Notify room
          this.server.to(sessionId).emit(SocketEvents.PARTICIPANT_LEFT, {
            participantId,
            leftAt: now.toISOString(),
          });

          console.log(`Grace period expired. Participant ${participantId} left session ${sessionId}`);
        }
      }
    }, 60000);
  }

  @SubscribeMessage(SocketEvents.JOIN_SESSION)
  async handleJoinSession(
    @MessageBody() data: { sessionId: string; participantId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    const { sessionId, participantId } = data;
    
    // Save state on socket
    socket.data.user.sessionId = sessionId;
    socket.data.user.participantId = participantId;

    // Join Socket.io room
    socket.join(sessionId);

    // Cancel reconnect grace period if any
    const redisKey = `reconnect_pending:${sessionId}:${participantId}`;
    await this.redis.del(redisKey);

    // Update socketId in Database
    await this.prisma.participant.update({
      where: { id: participantId },
      data: { socketId: socket.id },
    });

    // Notify room
    this.server.to(sessionId).emit(SocketEvents.PARTICIPANT_JOINED, {
      participantId,
      role: user.role,
      joinedAt: new Date().toISOString(),
    });

    console.log(`Participant ${participantId} (${user.role}) joined Socket room ${sessionId}`);
  }

  @SubscribeMessage(SocketEvents.LEAVE_SESSION)
  async handleLeaveSession(
    @MessageBody() data: { sessionId: string; participantId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { sessionId, participantId } = data;
    socket.leave(sessionId);

    const redisKey = `reconnect_pending:${sessionId}:${participantId}`;
    await this.redis.del(redisKey);

    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (participant && !participant.leftAt) {
      const now = new Date();
      const duration = Math.round((now.getTime() - participant.joinedAt.getTime()) / 1000);

      await this.prisma.participant.update({
        where: { id: participantId },
        data: { leftAt: now, durationSec: duration, socketId: null },
      });

      this.server.to(sessionId).emit(SocketEvents.PARTICIPANT_LEFT, {
        participantId,
        leftAt: now.toISOString(),
      });
    }

    console.log(`Participant ${participantId} explicitly left session ${sessionId}`);
  }

  @SubscribeMessage(SocketEvents.SEND_MESSAGE)
  async handleSendMessage(
    @MessageBody() data: { sessionId: string; content: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    const { sessionId, content } = data;

    // Persist message
    const message = await this.prisma.message.create({
      data: {
        sessionId,
        senderId: user.sub.startsWith('cust-') ? null : user.sub,
        senderName: user.email.split('@')[0], // Extract username as display name
        content,
      },
    });

    // Broadcast to room
    this.server.to(sessionId).emit(SocketEvents.MESSAGE_RECEIVED, {
      id: message.id,
      sessionId: message.sessionId,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    });
  }

  @SubscribeMessage(SocketEvents.TYPING)
  async handleTyping(
    @MessageBody() data: { sessionId: string; isTyping: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user || !user.participantId) return;

    socket.to(data.sessionId).emit(SocketEvents.USER_TYPING, {
      userId: user.participantId,
      isTyping: data.isTyping,
    });
  }

  // System hook to programmatically close all room connections when session ends
  sendSessionEnded(sessionId: string) {
    this.server.to(sessionId).emit(SocketEvents.SESSION_ENDED, { sessionId });
    
    // Disconnect clients in the room
    const clients = this.server.sockets.adapter.rooms.get(sessionId);
    if (clients) {
      for (const clientId of clients) {
        const clientSocket = this.server.sockets.sockets.get(clientId);
        if (clientSocket) {
          clientSocket.leave(sessionId);
        }
      }
    }
  }

  sendRecordingStarted(sessionId: string, recordingId: string) {
    this.server.to(sessionId).emit(SocketEvents.RECORDING_STARTED, { recordingId });
  }

  sendRecordingReady(sessionId: string, recordingId: string, url: string) {
    this.server.to(sessionId).emit(SocketEvents.RECORDING_READY, { recordingId, url });
  }
}
