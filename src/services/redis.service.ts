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

  constructor() {
    this.serviceName = config.service.name;
  }

  /**
   * Get or create Redis client (lazy initialization)
   */
  private getClient(): Redis {
    if (!this.client) {
      const redisConfig = config.redis;

      if (!redisConfig.host) {
        throw new Error('Redis host not configured. Set REDIS_HOST environment variable.');
      }

      this.client = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        tls: redisConfig.tls ? {} : undefined,
        lazyConnect: false,
        connectTimeout: 10000,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected', {
          operation: 'redis_connect',
          host: redisConfig.host,
          port: redisConfig.port,
        });
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error', {
          operation: 'redis_error',
          error: err.message,
        });
      });

      logger.info('Redis client initialized', {
        operation: 'redis_init',
        host: redisConfig.host,
        port: redisConfig.port,
        tls: redisConfig.tls,
      });
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
      const client = this.getClient();
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
      const client = this.getClient();
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
      const client = this.getClient();
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
      const client = this.getClient();
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
