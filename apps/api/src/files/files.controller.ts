import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, UseGuards, Request, Body, BadRequestException, Res, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('files')
export class FilesController {
  constructor(
    private filesService: FilesService,
    private prisma: PrismaService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Invalid file type. Only JPEG, PNG, GIF, WEBP, PDF, DOC, XLS, and TXT are allowed.'), false);
      }
    }
  }))
  async uploadFile(
    @Body('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required.');
    }
    if (!file) {
      throw new BadRequestException('File payload is missing.');
    }
    return this.filesService.uploadFile(sessionId, req.user.id, file);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getDownloadUrl(@Param('id') fileId: string) {
    return this.filesService.getDownloadUrl(fileId);
  }

  // Local filesystem fallback download endpoint (no auth guard so browser download works seamlessly from chat clicks)
  @Get('download/:id')
  async downloadLocalFile(@Param('id') fileId: string, @Res() res: Response) {
    const fileRecord = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!fileRecord) {
      throw new NotFoundException('File metadata not found in database.');
    }

    const uploadsDir = this.filesService.getLocalUploadsPath();
    // Resolve relative path: we stored it as 'sessions/{sessionId}/{fileId}-{name}'
    const filePath = path.join(uploadsDir, fileRecord.path);

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', fileRecord.type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.name)}"`);
      fs.createReadStream(filePath).pipe(res);
    } else {
      throw new NotFoundException('File not found on local storage disk.');
    }
  }
}
