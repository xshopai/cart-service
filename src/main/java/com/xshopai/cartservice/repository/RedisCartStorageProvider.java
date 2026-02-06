package com.xshopai.cartservice.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.xshopai.cartservice.model.Cart;
import io.quarkus.redis.datasource.ReactiveRedisDataSource;
import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.redis.datasource.value.ValueCommands;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.Optional;

/**
 * Direct Redis implementation of CartStorageProvider.
 * Used when STORAGE_PROVIDER=redis (default when Dapr is not available).
 */
@ApplicationScoped
public class RedisCartStorageProvider implements CartStorageProvider {
    
    @Inject
    Logger logger;
    
    @Inject
    RedisDataSource redisDS;
    
    private final ObjectMapper objectMapper;
    
    private static final String CART_PREFIX = "cart:";
    private static final String LOCK_PREFIX = "lock:cart:";
    private static final Duration DEFAULT_TTL = Duration.ofDays(30);
    private static final Duration LOCK_TTL = Duration.ofSeconds(30);
    
    private boolean available = false;
    
    public RedisCartStorageProvider() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
    }
    
    public void initialize() {
        try {
            // Test Redis connection
            ValueCommands<String, String> commands = redisDS.value(String.class, String.class);
            commands.set("health:test", "ok");
            String result = commands.get("health:test");
            if ("ok".equals(result)) {
                this.available = true;
                logger.info("Redis storage provider initialized successfully");
            }
        } catch (Exception e) {
            logger.warn("Failed to initialize Redis client: " + e.getMessage());
            this.available = false;
        }
    }
    
    @Override
    public Optional<Cart> findByUserId(String userId) {
        try {
            ValueCommands<String, String> commands = redisDS.value(String.class, String.class);
            String json = commands.get(CART_PREFIX + userId);
            
            if (json != null && !json.isEmpty()) {
                Cart cart = objectMapper.readValue(json, Cart.class);
                return Optional.of(cart);
            }
            return Optional.empty();
        } catch (Exception e) {
            logger.error("Error finding cart for user: " + userId, e);
            throw new RuntimeException("Failed to find cart", e);
        }
    }
    
    @Override
    public void save(Cart cart, Duration ttl) {
        try {
            ValueCommands<String, String> commands = redisDS.value(String.class, String.class);
            String json = objectMapper.writeValueAsString(cart);
            
            Duration effectiveTtl = ttl != null ? ttl : DEFAULT_TTL;
            commands.setex(CART_PREFIX + cart.getUserId(), effectiveTtl.getSeconds(), json);
            
            logger.debugf("Saved cart for user: %s via Redis (TTL: %s)", cart.getUserId(), effectiveTtl);
        } catch (JsonProcessingException e) {
            logger.error("Error serializing cart for user: " + cart.getUserId(), e);
            throw new RuntimeException("Failed to serialize cart", e);
        } catch (Exception e) {
            logger.error("Error saving cart for user: " + cart.getUserId(), e);
            throw new RuntimeException("Failed to save cart", e);
        }
    }
    
    @Override
    public void delete(String userId) {
        try {
            ValueCommands<String, String> commands = redisDS.value(String.class, String.class);
            commands.getdel(CART_PREFIX + userId);
            logger.debugf("Deleted cart for user: %s via Redis", userId);
        } catch (Exception e) {
            logger.error("Error deleting cart for user: " + userId, e);
        }
    }
    
    @Override
    public boolean acquireLock(String userId, Duration lockDuration) {
        try {
            ValueCommands<String, String> commands = redisDS.value(String.class, String.class);
            String lockKey = LOCK_PREFIX + userId;
            
            // Use SETNX semantics - set if not exists
            String existing = commands.get(lockKey);
            if (existing != null && !existing.isEmpty()) {
                logger.debugf("Failed to acquire lock for user: %s - already locked", userId);
                return false;
            }
            
            Duration effectiveDuration = lockDuration != null ? lockDuration : LOCK_TTL;
            commands.setex(lockKey, effectiveDuration.getSeconds(), "locked");
            
            logger.debugf("Acquired lock for user: %s via Redis", userId);
            return true;
        } catch (Exception e) {
            logger.error("Error acquiring lock for user: " + userId, e);
            throw new RuntimeException("Failed to acquire lock", e);
        }
    }
    
    @Override
    public void releaseLock(String userId) {
        try {
            ValueCommands<String, String> commands = redisDS.value(String.class, String.class);
            commands.getdel(LOCK_PREFIX + userId);
            logger.debugf("Released lock for user: %s via Redis", userId);
        } catch (Exception e) {
            logger.error("Error releasing lock for user: " + userId, e);
        }
    }
    
    @Override
    public boolean isAvailable() {
        return available;
    }
    
    @Override
    public String getProviderName() {
        return "redis";
    }
}
