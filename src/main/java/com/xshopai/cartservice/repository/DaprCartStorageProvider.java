package com.xshopai.cartservice.repository;

import com.xshopai.cartservice.model.Cart;
import io.dapr.client.DaprClient;
import io.dapr.client.DaprClientBuilder;
import io.dapr.client.domain.State;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.Optional;

/**
 * Dapr State Store implementation of CartStorageProvider.
 * Used when STORAGE_PROVIDER=dapr or when running with Dapr sidecars.
 */
@ApplicationScoped
public class DaprCartStorageProvider implements CartStorageProvider {
    
    @Inject
    Logger logger;
    
    @ConfigProperty(name = "dapr.state-store", defaultValue = "statestore")
    String stateStoreName;
    
    @ConfigProperty(name = "dapr.grpc.port", defaultValue = "50001")
    int daprGrpcPort;
    
    private DaprClient daprClient;
    private boolean available = false;
    private String lastError = null;
    
    private static final String CART_PREFIX = "cart:";
    private static final String LOCK_PREFIX = "lock:cart:";
    
    public void initialize() {
        try {
            logger.info("Initializing Dapr storage provider...");
            this.daprClient = new DaprClientBuilder().build();
            // Test connection by doing a ping
            daprClient.waitForSidecar(5000).block();
            this.available = true;
            this.lastError = null;
            logger.info("Dapr client initialized for state store: " + stateStoreName);
        } catch (Exception e) {
            this.lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            logger.warn("Failed to initialize Dapr client: " + lastError + ". Dapr storage will not be available.");
            this.available = false;
        }
    }
    
    public String getLastError() {
        return lastError;
    }
    
    @PreDestroy
    void cleanup() {
        try {
            if (daprClient != null) {
                daprClient.close();
            }
        } catch (Exception e) {
            logger.error("Error closing Dapr client", e);
        }
    }
    
    @Override
    public Optional<Cart> findByUserId(String userId) {
        if (!available) {
            throw new IllegalStateException("Dapr storage provider not available");
        }
        try {
            State<Cart> state = daprClient.getState(
                stateStoreName, 
                CART_PREFIX + userId, 
                Cart.class
            ).block();
            
            if (state != null && state.getValue() != null) {
                return Optional.of(state.getValue());
            }
            return Optional.empty();
        } catch (Exception e) {
            logger.error("Error finding cart for user: " + userId, e);
            throw new RuntimeException("Failed to find cart", e);
        }
    }
    
    @Override
    public void save(Cart cart, Duration ttl) {
        if (!available) {
            throw new IllegalStateException("Dapr storage provider not available");
        }
        try {
            daprClient.saveState(
                stateStoreName,
                CART_PREFIX + cart.getUserId(),
                cart
            ).block();
            
            logger.debugf("Saved cart for user: %s via Dapr", cart.getUserId());
        } catch (Exception e) {
            logger.error("Error saving cart for user: " + cart.getUserId(), e);
            throw new RuntimeException("Failed to save cart", e);
        }
    }
    
    @Override
    public void delete(String userId) {
        if (!available) {
            throw new IllegalStateException("Dapr storage provider not available");
        }
        try {
            daprClient.deleteState(stateStoreName, CART_PREFIX + userId).block();
            logger.debugf("Deleted cart for user: %s via Dapr", userId);
        } catch (Exception e) {
            logger.error("Error deleting cart for user: " + userId, e);
        }
    }
    
    @Override
    public boolean acquireLock(String userId, Duration lockDuration) {
        if (!available) {
            throw new IllegalStateException("Dapr storage provider not available");
        }
        try {
            State<String> existingLock = daprClient.getState(
                stateStoreName,
                LOCK_PREFIX + userId,
                String.class
            ).block();
            
            if (existingLock != null && existingLock.getValue() != null && !existingLock.getValue().isEmpty()) {
                logger.debugf("Failed to acquire lock for user: %s - already locked", userId);
                return false;
            }
            
            daprClient.saveState(
                stateStoreName,
                LOCK_PREFIX + userId,
                "locked"
            ).block();
            
            logger.debugf("Acquired lock for user: %s via Dapr", userId);
            return true;
        } catch (Exception e) {
            logger.error("Error acquiring lock for user: " + userId, e);
            throw new RuntimeException("Failed to acquire lock", e);
        }
    }
    
    @Override
    public void releaseLock(String userId) {
        if (!available) {
            return;
        }
        try {
            daprClient.deleteState(stateStoreName, LOCK_PREFIX + userId).block();
            logger.debugf("Released lock for user: %s via Dapr", userId);
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
        return "dapr";
    }
}
