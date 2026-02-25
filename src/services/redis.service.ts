/**
 * Redis Service - Direct Redis state operations
 * Used when running on Azure App Service (no Dapr sidecar)
 */
import { Redis } from 'ioredis';
import config from '../core/config.js';
import logger from '../core/logger.js';
import { Cart } from '../models/cart.model.js';

class RedisService {
  private client: Redis | null = null;
  private isConnecting: boolean = false;
  private readonly serviceName: string;

  constructor() {
    this.serviceName = config.service.name;
  }

  /**
   * Get or create Redis client with proper reconnection handling
   */
  private async getClient(): Promise<Redis> {
    // If client exists and is ready, return it
    if (this.client && (this.client.status as string) === 'ready') {
      return this.client;
    }

    // If client exists but is closed/end, reset it
    if (this.client && (this.client.status === 'close' || this.client.status === 'end')) {
      logger.info('Redis client was closed, recreating...');
      this.client = null;
    }

    // Create new client if needed
    if (!this.client && !this.isConnecting) {
      this.isConnecting = true;
      const redisConfig = config.redis;

      if (!redisConfig.host) {
        this.isConnecting = false;
        throw new Error('Redis host not configured. Set REDIS_HOST environment variable.');
      }

      logger.info('Creating Redis client', {
        operation: 'redis_init',
        host: redisConfig.host,
        port: redisConfig.port,
        tls: redisConfig.tls,
      });

      this.client = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        tls: redisConfig.tls ? { rejectUnauthorized: false } : undefined,
        lazyConnect: true, // Connect manually to handle errors
        connectTimeout: 15000,
        commandTimeout: 10000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        retryStrategy: (times: number) => {
          // Always retry with exponential backoff, cap at 5 seconds
          const delay = Math.min(times * 500, 5000);
          logger.warn(`Redis reconnecting, attempt ${times}, delay ${delay}ms`);
          return delay;
        },
        reconnectOnError: (err) => {
          // Reconnect on connection reset or timeout
          const targetErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
          return targetErrors.some(e => err.message.includes(e));
        },
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected', {
          operation: 'redis_connect',
          host: redisConfig.host,
          port: redisConfig.port,
        });
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready', { operation: 'redis_ready' });
        this.isConnecting = false;
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error', {
          operation: 'redis_error',
          error: err.message,
        });
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed', { operation: 'redis_close' });
      });

      this.client.on('end', () => {
        logger.warn('Redis connection ended', { operation: 'redis_end' });
        this.isConnecting = false;
      });

      // Manually connect and wait for ready
      try {
        await this.client.connect();
      } catch (err) {
        this.isConnecting = false;
        logger.error('Redis connect failed', {
          operation: 'redis_connect_error',
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    // Wait for client to be ready if connecting
    if (this.client && (this.client.status as string) !== 'ready') {
      // Wait up to 10 seconds for ready state
      const maxWait = 10000;
      const startTime = Date.now();
      while ((this.client.status as string) !== 'ready' && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if ((this.client.status as string) !== 'ready') {
        throw new Error(`Redis not ready after ${maxWait}ms, status: ${this.client.status}`);
      }
    }

    if (!this.client) {
      throw new Error('Failed to create Redis client');
    }

    return this.client;
  }

  /**
   * Generate cart key for Redis
   */
  private getCartKey(userId: string): string {
    return `cart:${userId}`;
  }

  /**
   * Get cart state from Redis
   */
  async getState(userId: string): Promise<Cart | null> {
    try {
      const client = await this.getClient();
      const key = this.getCartKey(userId);

      const data = await client.get(key);

      if (!data) {
        logger.debug('Cart not found in Redis', { userId, key });
        return null;
      }

      logger.debug('Cart retrieved from Redis', { userId, key });
      return JSON.parse(data) as Cart;
    } catch (error) {
      logger.error('Failed to get cart state from Redis', {
        operation: 'get_state',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Save cart state to Redis
   */
  async saveState(cart: Cart): Promise<void> {
    try {
      const client = await this.getClient();
      const key = this.getCartKey(cart.userId);

      // Calculate TTL in seconds
      const ttlSeconds = Math.floor((cart.expiresAt - Date.now()) / 1000);
      const effectiveTtl = Math.max(ttlSeconds, 60); // Minimum 60 seconds

      await client.setex(key, effectiveTtl, JSON.stringify(cart));

      logger.debug('Cart saved to Redis', {
        userId: cart.userId,
        key,
        ttlSeconds: effectiveTtl,
        itemCount: cart.items.length,
      });
    } catch (error) {
      logger.error('Failed to save cart state to Redis', {
        operation: 'save_state',
        userId: cart.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete cart state from Redis
   */
  async deleteState(userId: string): Promise<void> {
    try {
      const client = await this.getClient();
      const key = this.getCartKey(userId);

      await client.del(key);

      logger.debug('Cart deleted from Redis', { userId, key });
    } catch (error) {
      logger.error('Failed to delete cart state from Redis', {
        operation: 'delete_state',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check Redis connection health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis client closed');
    }
  }
}

export default new RedisService();
