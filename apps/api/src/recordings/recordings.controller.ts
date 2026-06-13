import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { Role } from '@vsp/shared';
import { RecordingsService } from './recordings.service';
import { StartRecordingDto, StopRecordingDto } from './dto/recordings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('recordings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.AGENT, Role.ADMIN)
export class RecordingsController {
  constructor(private recordingsService: RecordingsService) {}

  @Post('start')
  async startRecording(@Body() dto: StartRecordingDto, @Request() req: any) {
    return this.recordingsService.startRecording(dto.sessionId, req.user.id);
  }

  @Post('stop')
  async stopRecording(@Body() dto: StopRecordingDto, @Request() req: any) {
    return this.recordingsService.stopRecording(dto.sessionId, req.user.id);
  }

  @Get(':id')
  async getRecording(@Param('id') id: string) {
    return this.recordingsService.getRecording(id);
  }
}
