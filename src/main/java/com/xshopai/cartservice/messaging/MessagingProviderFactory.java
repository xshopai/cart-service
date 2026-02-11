package com.xshopai.cartservice.messaging;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Messaging Provider Factory
 * 
 * Creates the appropriate messaging provider based on configuration.
 * Supports: Dapr (default), RabbitMQ, Azure Service Bus
 * 
 * Configuration:
 * - messaging.provider=dapr (default)
 * - messaging.provider=rabbitmq
 * - messaging.provider=servicebus
 */
@ApplicationScoped
public class MessagingProviderFactory {
    
    @Inject
    Logger logger;
    
    @Inject
    DaprMessagingProvider daprProvider;
    
    @Inject
    RabbitMQMessagingProvider rabbitMQProvider;
    
    @Inject
    ServiceBusMessagingProvider serviceBusProvider;
    
    @ConfigProperty(name = "messaging.provider", defaultValue = "dapr")
    String providerType;
    
    @Produces
    @ApplicationScoped
    public MessagingProvider createMessagingProvider() {
        MessagingProvider provider;
        
        switch (providerType.toLowerCase()) {
            case "rabbitmq":
                logger.info("Using RabbitMQ messaging provider");
                provider = rabbitMQProvider;
                break;
            case "servicebus":
            case "azureservicebus":
                logger.info("Using Azure Service Bus messaging provider");
                provider = serviceBusProvider;
                break;
            case "dapr":
            default:
                logger.info("Using Dapr messaging provider (default)");
                provider = daprProvider;
                break;
        }
        
        // Initialize the provider
        provider.initialize();
        
        return provider;
    }
}
