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
  private readonly serviceName: string;
  private initPromise: Promise<Redis> | null = null;

  constructor() {
    this.serviceName = config.service.name;
  }

  /**
   * Get or create Redis client with proper reconnection handling
   */
  private async getClient(): Promise<Redis> {
    // Return existing client if ready
    if (this.client && (this.client.status as string) === 'ready') {
      return this.client;
    }

    // If already initializing, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // If client exists but is closed, dispose it
    if (this.client && (this.client.status === 'end' || this.client.status === 'close')) {
      this.client.disconnect();
      this.client = null;
    }

    // Create new client
    this.initPromise = this.createClient();
    
    try {
      this.client = await this.initPromise;
      return this.client;
    } finally {
      this.initPromise = null;
    }
  }

  private createClient(): Promise<Redis> {
    return new Promise((resolve, reject) => {
      const redisConfig = config.redis;

      if (!redisConfig.host) {
        reject(new Error('Redis host not configured. Set REDIS_HOST environment variable.'));
        return;
      }

      logger.info('Creating Redis client', {
        operation: 'redis_init',
        host: redisConfig.host,
        port: redisConfig.port,
        tls: redisConfig.tls,
      });

      const client = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        username: undefined, // Azure Redis Cache access key auth - no username
        password: redisConfig.password || undefined,
        tls: redisConfig.tls ? {
          servername: redisConfig.host,
          rejectUnauthorized: false, // Azure Redis sometimes needs this
        } : undefined,
        connectTimeout: 20000,
        commandTimeout: 10000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: false, // Fail fast if not connected
        lazyConnect: false,
        retryStrategy: (times: number) => {
          // Always retry with exponential backoff, cap at 10 seconds
          const delay = Math.min(times * 1000, 10000);
          logger.warn(`Redis reconnecting, attempt ${times}, delay ${delay}ms`);
          return delay;
        },
      });

      client.on('ready', () => {
        logger.info('Redis client ready', {
          operation: 'redis_ready',
          host: redisConfig.host,
        });
        resolve(client);
      });

      client.on('error', (err) => {
        logger.error('Redis client error', {
          operation: 'redis_error',
          error: err.message,
        });
        // Don't reject on error - let retry strategy handle it
      });

      client.on('close', () => {
        logger.warn('Redis connection closed', { operation: 'redis_close' });
      });

      // Timeout for initial connection
      setTimeout(() => {
        if ((client.status as string) !== 'ready') {
          reject(new Error(`Redis connection timeout, status: ${client.status}`));
        }
      }, 25000);
    });
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
