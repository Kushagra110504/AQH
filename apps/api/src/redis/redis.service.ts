import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private fallbackMap = new Map<string, { value: string; expiry?: number }>();
  private isFallback = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        if (!this.isFallback) {
          console.warn('Redis connection failed, switching to in-memory fallback mode.');
          this.isFallback = true;
        }
      });

      this.client.connect().catch(() => {
        this.isFallback = true;
      });

      console.log('Redis initialized.');
    } catch (err) {
      console.warn('Redis initialization error, running in local fallback mode:', err.message);
      this.isFallback = true;
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isFallback || !this.client) {
      const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
      this.fallbackMap.set(key, { value, expiry });
      return;
    }

    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      this.isFallback = true;
      this.set(key, value, ttlSeconds);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isFallback || !this.client) {
      const entry = this.fallbackMap.get(key);
      if (!entry) return null;
      if (entry.expiry && entry.expiry < Date.now()) {
        this.fallbackMap.delete(key);
        return null;
      }
      return entry.value;
    }

    try {
      return await this.client.get(key);
    } catch (err) {
      this.isFallback = true;
      return this.get(key);
    }
  }

  async del(key: string): Promise<void> {
    if (this.isFallback || !this.client) {
      this.fallbackMap.delete(key);
      return;
    }

    try {
      await this.client.del(key);
    } catch (err) {
      this.isFallback = true;
      this.del(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.isFallback || !this.client) {
      const entry = this.fallbackMap.get(key);
      if (!entry) return false;
      if (entry.expiry && entry.expiry < Date.now()) {
        this.fallbackMap.delete(key);
        return false;
      }
      return true;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (err) {
      this.isFallback = true;
      return this.exists(key);
    }
  }
}
