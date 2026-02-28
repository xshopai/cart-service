/**
 * Storage Factory - Abstracts storage backend (Dapr vs Redis)
 * Returns the appropriate storage service based on PLATFORM_MODE config
 */
import config from '../core/config.js';
import logger from '../core/logger.js';
import { Cart } from '../models/cart.model.js';
import daprService from './dapr.service.js';
import redisService from './redis.service.js';

export interface StorageService {
  getState(userId: string): Promise<Cart | null>;
  saveState(cart: Cart): Promise<void>;
  deleteState(userId: string): Promise<void>;
  checkHealth(): Promise<boolean>;
  publishEvent(topic: string, eventData: Record<string, unknown>, correlationId?: string): Promise<boolean>;
}

/**
 * Get the appropriate storage service based on PLATFORM_MODE
 * - 'direct': Direct Redis connection (Azure App Service)
 * - 'dapr': Through Dapr sidecar (Azure Container Apps / K8s)
 */
function getStorageService(): StorageService {
  const mode = config.serviceInvocation.mode;

  logger.info('Initializing storage service', { mode });

  if (mode === 'direct') {
    // Direct Redis connection for App Service
    return {
      getState: (userId: string) => redisService.getState(userId),
      saveState: (cart: Cart) => redisService.saveState(cart),
      deleteState: (userId: string) => redisService.deleteState(userId),
      checkHealth: () => redisService.checkHealth(),
      // No pubsub in http mode - just log and return success
      publishEvent: async (topic: string, eventData: Record<string, unknown>) => {
        logger.debug('Skipping event publish in direct mode', { topic, eventData });
        return true;
      },
    };
  }

  // Default to Dapr for Container Apps / K8s
  return {
    getState: (userId: string) => daprService.getState(userId),
    saveState: (cart: Cart) => daprService.saveState(cart),
    deleteState: (userId: string) => daprService.deleteState(userId),
    checkHealth: () => daprService.checkHealth(),
    publishEvent: (topic: string, eventData: Record<string, unknown>, correlationId?: string) =>
      daprService.publishEvent(topic, eventData, correlationId),
  };
}

// Export singleton storage service
const storageService = getStorageService();
export default storageService;
