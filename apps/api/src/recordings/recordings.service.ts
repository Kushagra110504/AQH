import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EgressClient, EncodedFileOutput, S3Upload } from 'livekit-server-sdk';
import { RecordingStatus } from '@vsp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class RecordingsService {
  private egressClient: EgressClient | null = null;
  private minioEndpoint: string;
  private minioPort: number;
  private minioAccessKey: string;
  private minioSecretKey: string;
  private minioUseSSL: boolean;
  private minioBucket: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private realtimeGateway: RealtimeGateway,
  ) {
    const livekitUrl = this.config.get<string>('LIVEKIT_API_URL') || 'http://localhost:7880';
    const livekitApiKey = this.config.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const livekitApiSecret = this.config.get<string>('LIVEKIT_API_SECRET') || 'secret';

    try {
      this.egressClient = new EgressClient(livekitUrl, livekitApiKey, livekitApiSecret);
    } catch (err) {
      console.warn('Failed to initialize EgressClient:', err.message);
    }

    this.minioEndpoint = this.config.get<string>('MINIO_ENDPOINT') || 'localhost';
    this.minioPort = parseInt(this.config.get<string>('MINIO_PORT') || '9000', 10);
    this.minioAccessKey = this.config.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    this.minioSecretKey = this.config.get<string>('MINIO_SECRET_KEY') || 'minioadminpassword';
    this.minioUseSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';
    this.minioBucket = this.config.get<string>('MINIO_BUCKET') || 'support-assets';
  }

  async startRecording(sessionId: string, agentId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active.');
    }

    // Check if recording already running
    const existing = await this.prisma.recording.findFirst({
      where: { sessionId, status: RecordingStatus.RECORDING },
    });
    if (existing) {
      throw new BadRequestException('Recording is already in progress.');
    }

    let egressId = `mock-egress-${Math.random().toString(36).substring(2, 11)}`;
    let isMock = true;

    if (this.egressClient) {
      try {
        const info = await this.egressClient.startRoomCompositeEgress(
          sessionId,
          new EncodedFileOutput({
            filepath: `recordings/${sessionId}-${Date.now()}.mp4`,
            output: {
              case: 's3',
              value: new S3Upload({
                endpoint: `http://${this.minioEndpoint}:${this.minioPort}`,
                accessKey: this.minioAccessKey,
                secret: this.minioSecretKey,
                bucket: this.minioBucket,
              }),
            },
          })
        );
        egressId = info.egressId;
        isMock = false;
      } catch (err) {
        console.warn('LiveKit Egress failed to start, falling back to mock recording:', err.message);
      }
    }

    const recording = await this.prisma.recording.create({
      data: {
        id: egressId,
        sessionId,
        status: RecordingStatus.RECORDING,
      },
    });

    // Notify room
    this.realtimeGateway.sendRecordingStarted(sessionId, recording.id);

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorId: agentId,
        action: 'START_RECORDING',
        metadata: JSON.stringify({ sessionId, recordingId: recording.id, isMock }),
      },
    });

    return recording;
  }

  async stopRecording(sessionId: string, agentId: string) {
    const recording = await this.prisma.recording.findFirst({
      where: { sessionId, status: RecordingStatus.RECORDING },
    });

    if (!recording) {
      throw new NotFoundException('No active recording in progress for this session.');
    }

    const isMock = recording.id.startsWith('mock-egress');

    if (!isMock && this.egressClient) {
      try {
        await this.egressClient.stopEgress(recording.id);
      } catch (err) {
        console.error('Failed to stop LiveKit egress:', err.message);
      }
    }

    // Mark as processing
    await this.prisma.recording.update({
      where: { id: recording.id },
      data: { status: RecordingStatus.PROCESSING },
    });

    // Handle compilation & MinIO availability simulation
    const storagePath = `recordings/${sessionId}-${recording.id}.mp4`;
    const duration = 120; // 2 minutes placeholder

    // In a real setup, Egress finishes asynchronously and sends Webhook.
    // For our hackathon build, we simulate instant ready or update.
    const updated = await this.prisma.recording.update({
      where: { id: recording.id },
      data: {
        status: RecordingStatus.READY,
        storagePath,
        durationSec: duration,
      },
    });

    // Generate public or pre-signed URL for client access
    const downloadUrl = `/files/download/recordings/${recording.id}`;

    // Notify room
    this.realtimeGateway.sendRecordingReady(sessionId, recording.id, downloadUrl);

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorId: agentId,
        action: 'STOP_RECORDING',
        metadata: JSON.stringify({ sessionId, recordingId: recording.id, duration }),
      },
    });

    return updated;
  }

  async getRecording(id: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id },
    });
    if (!recording) {
      throw new NotFoundException('Recording not found.');
    }
    return recording;
  }
}
