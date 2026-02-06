package com.xshopai.cartservice.repository;

import com.xshopai.cartservice.model.Cart;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.Optional;

/**
 * Cart repository that delegates to the appropriate storage provider.
 * Uses Dapr when available/configured, falls back to direct Redis.
 */
@ApplicationScoped
public class CartRepository {
    
    @Inject
    Logger logger;
    
    @Inject
    DaprCartStorageProvider daprProvider;
    
    @Inject
    RedisCartStorageProvider redisProvider;
    
    @ConfigProperty(name = "cart.storage.provider", defaultValue = "auto")
    String configuredProvider;
    
    private CartStorageProvider activeProvider;
    
    @PostConstruct
    void init() {
        logger.infof("Configured storage provider: %s", configuredProvider);
        
        if ("dapr".equalsIgnoreCase(configuredProvider)) {
            // Explicitly configured to use Dapr
            daprProvider.initialize();
            if (daprProvider.isAvailable()) {
                activeProvider = daprProvider;
                logger.info("Using Dapr storage provider (explicitly configured)");
            } else {
                logger.warn("Dapr configured but not available, falling back to Redis");
                redisProvider.initialize();
                activeProvider = redisProvider;
            }
        } else if ("redis".equalsIgnoreCase(configuredProvider)) {
            // Explicitly configured to use Redis
            redisProvider.initialize();
            activeProvider = redisProvider;
            logger.info("Using Redis storage provider (explicitly configured)");
        } else {
            // Auto-detect: try Dapr first, fall back to Redis
            logger.info("Auto-detecting storage provider...");
            daprProvider.initialize();
            if (daprProvider.isAvailable()) {
                activeProvider = daprProvider;
                logger.info("Using Dapr storage provider (auto-detected)");
            } else {
                logger.info("Dapr not available, using Redis storage provider");
                redisProvider.initialize();
                activeProvider = redisProvider;
            }
        }
        
        if (activeProvider == null || !activeProvider.isAvailable()) {
            throw new IllegalStateException("No storage provider available! Check Redis/Dapr configuration.");
        }
        
        logger.infof("Cart storage initialized with provider: %s", activeProvider.getProviderName());
    }
    
    public Optional<Cart> findByUserId(String userId) {
        return activeProvider.findByUserId(userId);
    }
    
    public void save(Cart cart, Duration ttl) {
        activeProvider.save(cart, ttl);
    }
    
    public void delete(String userId) {
        activeProvider.delete(userId);
    }
    
    public boolean acquireLock(String userId, Duration lockDuration) {
        return activeProvider.acquireLock(userId, lockDuration);
    }
    
    public void releaseLock(String userId) {
        activeProvider.releaseLock(userId);
    }
    
    public String getActiveProviderName() {
        return activeProvider != null ? activeProvider.getProviderName() : "none";
    }
}
