package com.xshopai.cartservice.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dapr.client.DaprClient;
import io.dapr.client.DaprClientBuilder;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Dapr Messaging Provider
 * 
 * Uses Dapr pub/sub API for broker-agnostic messaging.
 * Supports any Dapr-compatible message broker (RabbitMQ, Kafka, Azure Service Bus, etc.)
 */
@ApplicationScoped
@Typed(DaprMessagingProvider.class)
public class DaprMessagingProvider implements MessagingProvider {
    
    @Inject
    Logger logger;
    
    @Inject
    ObjectMapper objectMapper;
    
    @ConfigProperty(name = "dapr.pubsub.name", defaultValue = "pubsub")
    String pubsubName;
    
    @ConfigProperty(name = "dapr.grpc.port", defaultValue = "50001")
    int daprGrpcPort;
    
    private DaprClient daprClient;
    private volatile boolean initialized = false;
    
    @Override
    public String getProviderName() {
        return "dapr";
    }
    
    @Override
    public void initialize() {
        if (initialized) {
            return;
        }
        
        try {
            // Set gRPC port via system property (DaprClientBuilder 1.11 uses env/property)
            System.setProperty("dapr.grpc.port", String.valueOf(daprGrpcPort));
            daprClient = new DaprClientBuilder()
                .build();
            
            initialized = true;
            logger.infof("Dapr messaging provider initialized: pubsub=%s, grpcPort=%d", 
                pubsubName, daprGrpcPort);
        } catch (Exception e) {
            logger.errorf("Failed to initialize Dapr messaging provider: %s", e.getMessage());
            throw new RuntimeException("Failed to initialize Dapr messaging provider", e);
        }
    }
    
    @Override
    public CompletableFuture<Boolean> publishEventAsync(
            String topic, 
            Object eventData, 
            String correlationId) {
        
        if (!initialized) {
            logger.warn("Dapr messaging provider not initialized, initializing now");
            initialize();
        }
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Build CloudEvents-compliant event wrapper
                Map<String, Object> cloudEvent = buildCloudEvent(topic, eventData, correlationId);
                
                logger.debugf("Publishing event via Dapr: topic=%s, correlationId=%s", 
                    topic, correlationId);
                
                // Publish via Dapr pub/sub
                daprClient.publishEvent(
                    pubsubName,
                    topic,
                    cloudEvent
                ).block();
                
                logger.infof("Event published successfully via Dapr: topic=%s, correlationId=%s", 
                    topic, correlationId);
                
                return true;
            } catch (Exception e) {
                logger.errorf("Failed to publish event via Dapr: topic=%s, correlationId=%s, error=%s",
                    topic, correlationId, e.getMessage());
                return false;
            }
        });
    }
    
    @Override
    public boolean isHealthy() {
        if (!initialized || daprClient == null) {
            return false;
        }
        
        try {
            // Try to get Dapr metadata as health check
            return true; // If client exists and initialized, consider healthy
        } catch (Exception e) {
            logger.debugf("Dapr health check failed: %s", e.getMessage());
            return false;
        }
    }
    
    @Override
    public void shutdown() {
        if (daprClient != null) {
            try {
                daprClient.close();
                logger.info("Dapr messaging provider shutdown complete");
            } catch (Exception e) {
                logger.warnf("Error during Dapr messaging provider shutdown: %s", e.getMessage());
            }
        }
        initialized = false;
    }
    
    /**
     * Build CloudEvents 1.0 compliant event structure
     */
    private Map<String, Object> buildCloudEvent(String topic, Object eventData, String correlationId) {
        Map<String, Object> cloudEvent = new HashMap<>();
        
        cloudEvent.put("specversion", "1.0");
        cloudEvent.put("type", "com.xshopai." + topic);
        cloudEvent.put("source", "cart-service");
        cloudEvent.put("id", UUID.randomUUID().toString());
        cloudEvent.put("time", java.time.Instant.now().toString());
        cloudEvent.put("datacontenttype", "application/json");
        cloudEvent.put("data", eventData);
        
        // Add correlation ID to metadata if provided
        if (correlationId != null && !correlationId.isEmpty()) {
            Map<String, String> metadata = new HashMap<>();
            metadata.put("correlationId", correlationId);
            metadata.put("x-correlation-id", correlationId);
            cloudEvent.put("metadata", metadata);
        }
        
        return cloudEvent;
    }
}
