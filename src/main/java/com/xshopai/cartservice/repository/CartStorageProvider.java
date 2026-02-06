package com.xshopai.cartservice.repository;

import com.xshopai.cartservice.model.Cart;

import java.time.Duration;
import java.util.Optional;

/**
 * Storage provider interface for cart operations.
 * Implementations can use Dapr State Store or direct Redis.
 */
public interface CartStorageProvider {
    
    /**
     * Find cart by user ID.
     */
    Optional<Cart> findByUserId(String userId);
    
    /**
     * Save cart with optional TTL.
     */
    void save(Cart cart, Duration ttl);
    
    /**
     * Delete cart by user ID.
     */
    void delete(String userId);
    
    /**
     * Acquire a distributed lock for cart operations.
     * @return true if lock acquired, false if already locked
     */
    boolean acquireLock(String userId, Duration lockDuration);
    
    /**
     * Release the distributed lock.
     */
    void releaseLock(String userId);
    
    /**
     * Check if the provider is available/healthy.
     */
    boolean isAvailable();
    
    /**
     * Get the provider name for logging.
     */
    String getProviderName();
}
