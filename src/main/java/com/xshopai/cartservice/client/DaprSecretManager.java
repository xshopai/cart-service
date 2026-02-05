package com.xshopai.cartservice.client;

import io.dapr.client.DaprClient;
import io.dapr.client.DaprClientBuilder;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.Optional;

/**
 * Dapr Secret Manager
 * Handles retrieving secrets with environment variable priority.
 * 
 * Priority:
 * 1. Environment variables/config (Azure deployment - injected from Key Vault)
 * 2. Dapr secret store (local development with .dapr/secrets.json)
 */
@ApplicationScoped
public class DaprSecretManager {

    @Inject
    Logger logger;

    @ConfigProperty(name = "dapr.secret-store", defaultValue = "secretstore")
    String secretStoreName;
    
    @ConfigProperty(name = "messaging.provider", defaultValue = "dapr")
    String messagingProvider;

    private DaprClient daprClient;
    private boolean daprEnabled;

    @PostConstruct
    void init() {
        this.daprEnabled = "dapr".equalsIgnoreCase(messagingProvider);
        
        if (daprEnabled) {
            this.daprClient = new DaprClientBuilder().build();
            logger.infof("Dapr Secret Manager initialized with store: %s", secretStoreName);
        } else {
            logger.infof("Dapr Secret Manager initialized (Dapr disabled - using env vars only)");
        }
    }

    @PreDestroy
    void cleanup() {
        if (daprClient != null) {
            try {
                daprClient.close();
                logger.info("Dapr client closed successfully");
            } catch (Exception e) {
                logger.error("Error closing Dapr client", e);
            }
        }
    }

    /**
     * Get a specific secret by key with Dapr secret store priority.
     * 
     * Priority:
     * 1. Dapr secret store (.dapr/secrets.json when running with Dapr)
     * 2. Environment variable (UPPER_SNAKE_CASE from .env file when running without Dapr)
     * 3. MicroProfile Config property (fallback)
     * 
     * @param key The secret key to retrieve (e.g., "jwt:secret" or "JWT_SECRET")
     * @return The secret value, or null if not found
     */
    public String getSecret(String key) {
        // Convert key to environment variable format (UPPER_SNAKE_CASE)
        String envKey = key.replace(":", "_").replace("-", "_").replace(".", "_").toUpperCase();
        
        // 1. Try Dapr secret store first (only if enabled)
        if (daprEnabled && daprClient != null) {
            try {
                logger.debugf("Retrieving secret from Dapr: %s", key);
                
                Map<String, String> secret = daprClient.getSecret(secretStoreName, key).block();
                
                if (secret != null && !secret.isEmpty()) {
                    String value = secret.values().stream().findFirst().orElse(null);
                    if (value != null && !value.isEmpty()) {
                        logger.debugf("Secret '%s' loaded from Dapr secret store", key);
                        return value;
                    }
                }
            } catch (Exception e) {
                logger.debugf("Dapr lookup failed for '%s', trying ENV: %s", key, e.getMessage());
            }
        }
        
        // 2. Fallback to environment variable (from .env file)
        String envValue = System.getenv(envKey);
        if (envValue != null && !envValue.isEmpty()) {
            logger.debugf("Secret '%s' loaded from environment variable: %s", key, envKey);
            return envValue;
        }
        
        // 3. Fallback to MicroProfile Config property
        try {
            Optional<String> configValue = ConfigProvider.getConfig()
                .getOptionalValue(key.replace(":", "."), String.class);
            if (configValue.isPresent() && !configValue.get().isEmpty()) {
                logger.debugf("Secret '%s' loaded from config property", key);
                return configValue.get();
            }
        } catch (Exception e) {
            logger.debugf("Config lookup failed for '%s': %s", key, e.getMessage());
        }
        
        logger.warnf("Secret not found: %s (tried Dapr, env: %s, and config)", key, envKey);
        return null;
    }

    /**
     * Get all secrets for a specific key (returns all metadata)
     * 
     * @param key The secret key to retrieve
     * @return Map of secret metadata
     */
    public Map<String, String> getSecrets(String key) {
        try {
            logger.debugf("Retrieving secrets for key: %s", key);
            return daprClient.getSecret(secretStoreName, key).block();
        } catch (Exception e) {
            logger.errorf("Failed to retrieve secrets for key: %s", key, e);
            throw new RuntimeException("Failed to retrieve secrets for key: " + key, e);
        }
    }

    /**
     * Get Redis password for state store
     * 
     * @return Redis password
     */
    public String getRedisPassword() {
        return getSecret("redis:password");
    }

    /**
     * Get JWT secret
     * Uses nested structure: jwt:secret
     * 
     * @return JWT secret
     */
    public String getJwtSecret() {
        return getSecret("jwt:secret");
    }
}
