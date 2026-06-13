import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { Role } from '@vsp/shared';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, JoinSessionDto } from './dto/sessions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT, Role.ADMIN)
  async createSession(@Request() req: any) {
    return this.sessionsService.createSession(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT, Role.ADMIN)
  async getSessions() {
    return this.sessionsService.getSessions();
  }

  // Public endpoint for customers joining with token
  @Post('join-customer')
  async joinCustomer(@Body() joinSessionDto: JoinSessionDto) {
    return this.sessionsService.joinAsCustomer(joinSessionDto.inviteToken, joinSessionDto.name);
  }

  @Post(':id/join-agent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT, Role.ADMIN)
  async joinAgent(@Param('id') sessionId: string, @Request() req: any) {
    return this.sessionsService.joinAsAgent(sessionId, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSessionById(@Param('id') id: string) {
    return this.sessionsService.getSessionById(id);
  }

  @Post(':id/end')
  @UseGuards(JwtAuthGuard)
  async endSession(@Param('id') sessionId: string, @Request() req: any) {
    return this.sessionsService.endSession(sessionId, req.user.id);
  }
}
