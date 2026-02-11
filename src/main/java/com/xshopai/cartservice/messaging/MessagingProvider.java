package com.xshopai.cartservice.messaging;

import java.util.concurrent.CompletableFuture;

/**
 * Messaging Provider Interface
 * 
 * Abstraction layer for message broker implementations.
 * Supports multiple providers: Dapr, RabbitMQ, Azure Service Bus.
 * 
 * Pattern: Strategy Pattern for pluggable messaging backends
 * Configuration: Switched via MESSAGING_PROVIDER environment variable
 */
public interface MessagingProvider {
    
    /**
     * Get the name of this messaging provider
     * 
     * @return Provider name (e.g., "dapr", "rabbitmq", "servicebus")
     */
    String getProviderName();
    
    /**
     * Publish an event to a topic
     * 
     * @param topic Event topic/routing key (e.g., "cart.item.added")
     * @param eventData Event payload (will be serialized to JSON)
     * @param correlationId Correlation ID for distributed tracing
     * @return CompletableFuture that completes when event is published
     */
    CompletableFuture<Boolean> publishEventAsync(
        String topic,
        Object eventData,
        String correlationId
    );
    
    /**
     * Publish an event synchronously (blocking)
     * 
     * @param topic Event topic/routing key
     * @param eventData Event payload
     * @param correlationId Correlation ID for tracing
     * @return true if published successfully, false otherwise
     */
    default boolean publishEvent(String topic, Object eventData, String correlationId) {
        try {
            return publishEventAsync(topic, eventData, correlationId).get();
        } catch (Exception e) {
            return false;
        }
    }
    
    /**
     * Check if the messaging provider is healthy and ready
     * 
     * @return true if healthy, false otherwise
     */
    boolean isHealthy();
    
    /**
     * Initialize the messaging provider
     * Called once at startup
     */
    void initialize();
    
    /**
     * Shutdown the messaging provider
     * Called at application shutdown
     */
    void shutdown();
}
