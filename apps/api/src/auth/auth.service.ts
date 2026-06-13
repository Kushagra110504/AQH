import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, JWTPayload } from '@vsp/shared';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === checkHash;
  }

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !this.verifyPassword(pass, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.generateTokens(user.id, user.email, user.role as unknown as Role);
  }

  async refresh(refreshToken: string) {
    try {
      const accessSecret = this.config.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key-12345';
      const payload = this.jwtService.verify<JWTPayload>(refreshToken, { secret: accessSecret });
      
      const redisKey = `refresh_token:${payload.sub}:${refreshToken}`;
      const exists = await this.redis.exists(redisKey);
      if (!exists) {
        throw new UnauthorizedException('Refresh token is invalid or has been revoked.');
      }

      // Revoke the old token
      await this.redis.del(redisKey);

      // Fetch user to ensure they still exist
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('User no longer exists.');
      }

      // Generate new tokens
      return this.generateTokens(user.id, user.email, user.role as unknown as Role);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async logout(refreshToken: string) {
    try {
      const accessSecret = this.config.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key-12345';
      const payload = this.jwtService.verify<JWTPayload>(refreshToken, { secret: accessSecret });
      const redisKey = `refresh_token:${payload.sub}:${refreshToken}`;
      await this.redis.del(redisKey);
    } catch (err) {
      // Fail silently on logout issues
    }
  }

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload: JWTPayload = { sub: userId, email, role };
    
    const accessTokenSecret = this.config.get<string>('JWT_ACCESS_SECRET') || 'access-secret-key-12345';
    const refreshTokenSecret = this.config.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret-key-12345';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessTokenSecret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshTokenSecret,
      expiresIn: '7d',
    });

    // Store in Redis with 7 days TTL (604800 seconds)
    const redisKey = `refresh_token:${userId}:${refreshToken}`;
    await this.redis.set(redisKey, 'valid', 604800);

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        role,
      },
    };
  }
}
