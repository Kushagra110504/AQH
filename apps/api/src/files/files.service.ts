import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService implements OnModuleInit {
  private minioClient: Minio.Client | null = null;
  private bucketName: string;
  private isLocalFS = false;
  private localUploadsDir = path.join(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = parseInt(this.config.get<string>('MINIO_PORT') || '9000', 10);
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY') || 'minioadminpassword';
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';

    try {
      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port: port,
        useSSL: useSSL,
        accessKey: accessKey,
        secretKey: secretKey,
      });
    } catch (err) {
      console.warn('MinIO initialization failed, using local filesystem fallback.');
      this.isLocalFS = true;
    }

    this.bucketName = this.config.get<string>('MINIO_BUCKET') || 'support-assets';
  }

  async onModuleInit() {
    // Ensure local uploads directory exists
    if (!fs.existsSync(this.localUploadsDir)) {
      fs.mkdirSync(this.localUploadsDir, { recursive: true });
    }

    if (this.isLocalFS || !this.minioClient) {
      console.log('Running FilesService in Local Filesystem mode.');
      return;
    }

    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        console.log(`MinIO bucket "${this.bucketName}" created.`);
      }
    } catch (err) {
      console.warn('Failed to verify MinIO bucket, switching to local filesystem mode:', err.message);
      this.isLocalFS = true;
    }
  }

  getLocalUploadsPath() {
    return this.localUploadsDir;
  }

  async uploadFile(
    sessionId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found.');
    }
    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot upload files to an inactive session.');
    }

    const fileId = Math.random().toString(36).substring(2, 11) + '-' + Date.now();
    const objectName = `sessions/${sessionId}/${fileId}-${file.originalname}`;

    if (this.isLocalFS) {
      try {
        const destFolder = path.join(this.localUploadsDir, 'sessions', sessionId);
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }

        const filePath = path.join(destFolder, `${fileId}-${file.originalname}`);
        fs.writeFileSync(filePath, file.buffer);

        const fileRecord = await this.prisma.file.create({
          data: {
            sessionId,
            userId: userId.startsWith('cust-') ? null : userId,
            name: file.originalname,
            path: objectName, // Keep identical identifier key for simplicity
            type: file.mimetype,
            size: file.size,
          },
        });

        return fileRecord;
      } catch (err) {
        console.error('Local file write error:', err);
        throw new BadRequestException('Failed to upload file locally.');
      }
    }

    try {
      await this.minioClient!.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        { 'content-type': file.mimetype },
      );

      const fileRecord = await this.prisma.file.create({
        data: {
          sessionId,
          userId: userId.startsWith('cust-') ? null : userId,
          name: file.originalname,
          path: objectName,
          type: file.mimetype,
          size: file.size,
        },
      });

      return fileRecord;
    } catch (err) {
      console.error('MinIO upload error:', err);
      throw new BadRequestException('Failed to upload file to MinIO.');
    }
  }

  async getDownloadUrl(fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException('File not found.');
    }

    if (this.isLocalFS) {
      // Return local NestJS download controller endpoint route
      const localUrl = `${this.config.get<string>('NEXT_PUBLIC_API_URL') || 'http://localhost:4000'}/files/download/${file.id}`;
      return { url: localUrl, name: file.name, type: file.type };
    }

    try {
      const downloadUrl = await this.minioClient!.presignedGetObject(
        this.bucketName,
        file.path,
        3600,
      );
      return { url: downloadUrl, name: file.name, type: file.type };
    } catch (err) {
      console.error('MinIO url generation error:', err);
      throw new BadRequestException('Failed to generate secure download link.');
    }
  }
}
