package com.xshopai.cartservice.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dapr.client.DaprClient;
import io.dapr.client.DaprClientBuilder;
import io.dapr.client.domain.HttpExtension;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import jakarta.inject.Inject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@ApplicationScoped
public class InventoryClient {
    
    @Inject
    Logger logger;
    
    @ConfigProperty(name = "inventory-service.url", defaultValue = "http://localhost:8005")
    String inventoryServiceUrl;
    
    @ConfigProperty(name = "cart.storage.provider", defaultValue = "auto")
    String storageProvider;
    
    private DaprClient daprClient;
    private HttpClient httpClient;
    private ObjectMapper objectMapper;
    private boolean useDapr = false;
    
    private static final String INVENTORY_SERVICE_APP_ID = "inventory-service";
    
    @PostConstruct
    void init() {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
        
        // Try to initialize Dapr if configured
        if (!"redis".equals(storageProvider)) {
            try {
                this.daprClient = new DaprClientBuilder().build();
                // Test Dapr connectivity
                daprClient.waitForSidecar(5000).block();
                this.useDapr = true;
                logger.info("InventoryClient: Using Dapr for service invocation");
            } catch (Exception e) {
                logger.warn("InventoryClient: Dapr not available, using direct HTTP calls to " + inventoryServiceUrl);
                this.useDapr = false;
                if (daprClient != null) {
                    try { daprClient.close(); } catch (Exception ignored) {}
                    daprClient = null;
                }
            }
        } else {
            logger.info("InventoryClient: Storage provider is 'redis', using direct HTTP calls");
        }
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
    
    public boolean checkAvailability(String sku, int quantity) {
        if (useDapr && daprClient != null) {
            return checkAvailabilityViaDapr(sku, quantity);
        } else {
            return checkAvailabilityViaHttp(sku, quantity);
        }
    }
    
    private boolean checkAvailabilityViaDapr(String sku, int quantity) {
        try {
            String url = "/api/inventory/check";
            
            logger.infof("Calling inventory service via Dapr: url=%s, sku=%s, quantity=%d", url, sku, quantity);
            
            Map<String, Object> requestBody = Map.of(
                "sku", sku,
                "quantity", quantity
            );
            
            @SuppressWarnings("unchecked")
            Map<String, Object> response = daprClient.invokeMethod(
                INVENTORY_SERVICE_APP_ID,
                url,
                requestBody,
                HttpExtension.POST,
                Map.class
            ).block();
            
            logger.infof("Inventory service response: %s", response);
            
            if (response != null && response.containsKey("available")) {
                boolean available = Boolean.TRUE.equals(response.get("available"));
                logger.infof("Inventory availability result: sku=%s, available=%s", sku, available);
                return available;
            }
            
            logger.warnf("Inventory service response missing 'available' field: %s", response);
            return false;
        } catch (Exception e) {
            logger.errorf(e, "Failed to check inventory via Dapr for SKU %s: %s", sku, e.getMessage());
            throw new RuntimeException("Failed to check inventory: " + sku, e);
        }
    }
    
    private boolean checkAvailabilityViaHttp(String sku, int quantity) {
        try {
            String url = inventoryServiceUrl + "/api/inventory/check";
            
            logger.infof("Calling inventory service via HTTP: url=%s, sku=%s, quantity=%d", url, sku, quantity);
            
            Map<String, Object> requestBody = Map.of(
                "sku", sku,
                "quantity", quantity
            );
            
            String jsonBody = objectMapper.writeValueAsString(requestBody);
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();
            
            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (httpResponse.statusCode() >= 200 && httpResponse.statusCode() < 300) {
                @SuppressWarnings("unchecked")
                Map<String, Object> response = objectMapper.readValue(httpResponse.body(), Map.class);
                
                logger.infof("Inventory service response: %s", response);
                
                if (response != null && response.containsKey("available")) {
                    boolean available = Boolean.TRUE.equals(response.get("available"));
                    logger.infof("Inventory availability result: sku=%s, available=%s", sku, available);
                    return available;
                }
                
                logger.warnf("Inventory service response missing 'available' field: %s", response);
                return false;
            } else {
                logger.errorf("HTTP error from inventory service: status=%d", httpResponse.statusCode());
                throw new RuntimeException("Failed to check inventory: HTTP " + httpResponse.statusCode());
            }
        } catch (Exception e) {
            logger.errorf(e, "Failed to check inventory via HTTP for SKU %s: %s", sku, e.getMessage());
            throw new RuntimeException("Failed to check inventory: " + sku, e);
        }
    }
}
