import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RecordingsModule } from './recordings/recordings.module';
import { FilesModule } from './files/files.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    SessionsModule,
    RealtimeModule,
    RecordingsModule,
    FilesModule,
    AdminModule,
  ],
})
export class AppModule {}
