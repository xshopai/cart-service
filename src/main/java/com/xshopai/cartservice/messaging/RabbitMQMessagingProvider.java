package com.xshopai.cartservice.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Typed;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * RabbitMQ Messaging Provider
 * 
 * Direct RabbitMQ implementation without Dapr.
 * Uses topic exchange for event routing.
 */
@ApplicationScoped
@Typed(RabbitMQMessagingProvider.class)
public class RabbitMQMessagingProvider implements MessagingProvider {
    
    @Inject
    Logger logger;
    
    @Inject
    ObjectMapper objectMapper;
    
    @ConfigProperty(name = "rabbitmq.host", defaultValue = "localhost")
    String host;
    
    @ConfigProperty(name = "rabbitmq.port", defaultValue = "5672")
    int port;
    
    @ConfigProperty(name = "rabbitmq.username", defaultValue = "admin")
    String username;
    
    @ConfigProperty(name = "rabbitmq.password", defaultValue = "admin123")
    String password;
    
    @ConfigProperty(name = "rabbitmq.exchange", defaultValue = "xshopai.events")
    String exchange;
    
    private Connection connection;
    private Channel channel;
    private volatile boolean initialized = false;
    
    @Override
    public String getProviderName() {
        return "rabbitmq";
    }
    
    @Override
    public void initialize() {
        if (initialized) {
            return;
        }
        
        try {
            ConnectionFactory factory = new ConnectionFactory();
            factory.setHost(host);
            factory.setPort(port);
            factory.setUsername(username);
            factory.setPassword(password);
            factory.setAutomaticRecoveryEnabled(true);
            
            connection = factory.newConnection();
            channel = connection.createChannel();
            
            // Declare topic exchange
            channel.exchangeDeclare(exchange, "topic", true);
            
            initialized = true;
            logger.infof("RabbitMQ messaging provider initialized: host=%s:%d, exchange=%s", 
                host, port, exchange);
        } catch (Exception e) {
            logger.errorf("Failed to initialize RabbitMQ messaging provider: %s", e.getMessage());
            throw new RuntimeException("Failed to initialize RabbitMQ messaging provider", e);
        }
    }
    
    @Override
    public CompletableFuture<Boolean> publishEventAsync(
            String topic, 
            Object eventData, 
            String correlationId) {
        
        if (!initialized) {
            logger.warn("RabbitMQ messaging provider not initialized, initializing now");
            initialize();
        }
        
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Build CloudEvents-compliant message
                Map<String, Object> cloudEvent = buildCloudEvent(topic, eventData, correlationId);
                String messageJson = objectMapper.writeValueAsString(cloudEvent);
                
                logger.debugf("Publishing event via RabbitMQ: topic=%s, correlationId=%s", 
                    topic, correlationId);
                
                // Publish to exchange with routing key = topic
                channel.basicPublish(
                    exchange,
                    topic,
                    null,
                    messageJson.getBytes(StandardCharsets.UTF_8)
                );
                
                logger.infof("Event published successfully via RabbitMQ: topic=%s, correlationId=%s", 
                    topic, correlationId);
                
                return true;
            } catch (Exception e) {
                logger.errorf("Failed to publish event via RabbitMQ: topic=%s, correlationId=%s, error=%s",
                    topic, correlationId, e.getMessage());
                return false;
            }
        });
    }
    
    @Override
    public boolean isHealthy() {
        return initialized && connection != null && connection.isOpen() && 
               channel != null && channel.isOpen();
    }
    
    @Override
    public void shutdown() {
        try {
            if (channel != null && channel.isOpen()) {
                channel.close();
            }
            if (connection != null && connection.isOpen()) {
                connection.close();
            }
            logger.info("RabbitMQ messaging provider shutdown complete");
        } catch (Exception e) {
            logger.warnf("Error during RabbitMQ messaging provider shutdown: %s", e.getMessage());
        }
        initialized = false;
    }
    
    private Map<String, Object> buildCloudEvent(String topic, Object eventData, String correlationId) {
        Map<String, Object> cloudEvent = new HashMap<>();
        
        cloudEvent.put("specversion", "1.0");
        cloudEvent.put("type", "com.xshopai." + topic);
        cloudEvent.put("source", "cart-service");
        cloudEvent.put("id", UUID.randomUUID().toString());
        cloudEvent.put("time", java.time.Instant.now().toString());
        cloudEvent.put("datacontenttype", "application/json");
        cloudEvent.put("data", eventData);
        
        if (correlationId != null && !correlationId.isEmpty()) {
            Map<String, String> metadata = new HashMap<>();
            metadata.put("correlationId", correlationId);
            cloudEvent.put("metadata", metadata);
        }
        
        return cloudEvent;
    }
}
