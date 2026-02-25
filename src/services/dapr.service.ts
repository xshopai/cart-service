/**
 * Dapr Service - State and Pub/Sub operations
 * Abstracts Dapr SDK interactions for cart state management and event publishing
 */
import { DaprClient, CommunicationProtocolEnum, StateConsistencyEnum, StateConcurrencyEnum } from '@dapr/dapr';
import { v4 as uuidv4 } from 'uuid';
import config from '../core/config.js';
import logger from '../core/logger.js';
import { Cart } from '../models/cart.model.js';

class DaprService {
  private client: DaprClient | null = null;
  private readonly stateStoreName: string;
  private readonly pubsubName: string;
  private readonly daprHost: string;
  private readonly daprPort: number;
  private readonly serviceName: string;

  constructor() {
    this.stateStoreName = config.dapr.stateStoreName;
    this.pubsubName = config.dapr.pubsubName;
    this.daprHost = config.dapr.host;
    this.daprPort = config.dapr.httpPort;
    this.serviceName = config.service.name;
  }

  /**
   * Get or create Dapr client (lazy initialization)
   */
  private getClient(): DaprClient {
    if (!this.client) {
      this.client = new DaprClient({
        daprHost: this.daprHost,
        daprPort: String(this.daprPort),
        communicationProtocol: CommunicationProtocolEnum.HTTP,
      });
      logger.info('Dapr client initialized', {
        operation: 'dapr_init',
        host: this.daprHost,
        port: this.daprPort,
        stateStore: this.stateStoreName,
        pubsub: this.pubsubName,
      });
    }
    return this.client;
  }

  /**
   * Get cart state from Dapr state store
   */
  async getState(userId: string): Promise<Cart | null> {
    try {
      const client = this.getClient();
      const key = this.getCartKey(userId);

      const result = await client.state.get(this.stateStoreName, key);

      if (!result) {
        logger.debug('Cart not found in state store', { userId, key });
        return null;
      }

      logger.debug('Cart retrieved from state store', { userId, key });
      return result as Cart;
    } catch (error) {
      logger.error('Failed to get cart state', {
        operation: 'get_state',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Save cart state to Dapr state store
   */
  async saveState(cart: Cart): Promise<void> {
    try {
      const client = this.getClient();
      const key = this.getCartKey(cart.userId);

      // Calculate TTL in seconds
      const ttlSeconds = Math.floor((cart.expiresAt - Date.now()) / 1000);

      await client.state.save(this.stateStoreName, [
        {
          key,
          value: cart,
          options: {
            consistency: StateConsistencyEnum.CONSISTENCY_STRONG,
            concurrency: StateConcurrencyEnum.CONCURRENCY_LAST_WRITE,
          },
          metadata: {
            ttlInSeconds: String(Math.max(ttlSeconds, 60)), // Minimum 60 seconds
          },
        },
      ]);

      logger.debug('Cart saved to state store', {
        userId: cart.userId,
        key,
        itemCount: cart.items.length,
        ttlSeconds,
      });
    } catch (error) {
      logger.error('Failed to save cart state', {
        operation: 'save_state',
        userId: cart.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete cart state from Dapr state store
   */
  async deleteState(userId: string): Promise<void> {
    try {
      const client = this.getClient();
      const key = this.getCartKey(userId);

      await client.state.delete(this.stateStoreName, key);

      logger.debug('Cart deleted from state store', { userId, key });
    } catch (error) {
      logger.error('Failed to delete cart state', {
        operation: 'delete_state',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Publish event to Dapr pub/sub
   */
  async publishEvent(topic: string, eventData: Record<string, any>, correlationId?: string): Promise<boolean> {
    try {
      const client = this.getClient();

      const cloudEvent = {
        id: uuidv4(),
        source: this.serviceName,
        type: `com.xshopai.${topic}`,
        specversion: '1.0',
        datacontenttype: 'application/json',
        time: new Date().toISOString(),
        data: eventData,
        correlationid: correlationId || uuidv4(),
      };

      await client.pubsub.publish(this.pubsubName, topic, cloudEvent);

      logger.info('Event published', {
        operation: 'publish_event',
        topic,
        eventId: cloudEvent.id,
        correlationId: cloudEvent.correlationid,
      });

      return true;
    } catch (error) {
      logger.error('Failed to publish event', {
        operation: 'publish_event',
        topic,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Generate cart key for state store
   */
  private getCartKey(userId: string): string {
    return `cart-${userId}`;
  }

  /**
   * Check Dapr state store health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const client = this.getClient();
      // Try to get a non-existent key to verify connectivity
      await client.state.get(this.stateStoreName, '__health_check__');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close Dapr client
   */
  async close(): Promise<void> {
    if (this.client) {
      logger.info('Closing Dapr client');
      this.client = null;
    }
  }
}

// Export singleton instance
export const daprService = new DaprService();
export default daprService;
