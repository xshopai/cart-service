package com.xshopai.cartservice.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xshopai.cartservice.model.ProductInfo;
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

@ApplicationScoped
public class ProductClient {
    
    @Inject
    Logger logger;
    
    @ConfigProperty(name = "product-service.url", defaultValue = "http://localhost:8001")
    String productServiceUrl;
    
    @ConfigProperty(name = "cart.storage.provider", defaultValue = "auto")
    String storageProvider;
    
    private DaprClient daprClient;
    private HttpClient httpClient;
    private ObjectMapper objectMapper;
    private boolean useDapr = false;
    
    private static final String PRODUCT_SERVICE_APP_ID = "product-service";
    
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
                logger.info("ProductClient: Using Dapr for service invocation");
            } catch (Exception e) {
                logger.warn("ProductClient: Dapr not available, using direct HTTP calls to " + productServiceUrl);
                this.useDapr = false;
                if (daprClient != null) {
                    try { daprClient.close(); } catch (Exception ignored) {}
                    daprClient = null;
                }
            }
        } else {
            logger.info("ProductClient: Storage provider is 'redis', using direct HTTP calls");
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
    
    public ProductInfo getProduct(String productId) {
        if (useDapr && daprClient != null) {
            return getProductViaDapr(productId);
        } else {
            return getProductViaHttp(productId);
        }
    }
    
    private ProductInfo getProductViaDapr(String productId) {
        try {
            ProductInfo product = daprClient.invokeMethod(
                PRODUCT_SERVICE_APP_ID,
                "/api/products/" + productId,
                null,
                HttpExtension.GET,
                ProductInfo.class
            ).block();
            
            return product;
        } catch (Exception e) {
            logger.errorf("Failed to get product %s via Dapr: %s", productId, e.getMessage());
            throw new RuntimeException("Failed to get product: " + productId, e);
        }
    }
    
    private ProductInfo getProductViaHttp(String productId) {
        try {
            String url = productServiceUrl + "/api/products/" + productId;
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
            
            HttpResponse<String> response = httpClient.send(request, 
                HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return objectMapper.readValue(response.body(), ProductInfo.class);
            } else if (response.statusCode() == 404) {
                logger.warnf("Product %s not found", productId);
                return null;
            } else {
                logger.errorf("Failed to get product %s: HTTP %d", productId, response.statusCode());
                throw new RuntimeException("Failed to get product: " + productId);
            }
        } catch (Exception e) {
            logger.errorf("Failed to get product %s via HTTP: %s", productId, e.getMessage());
            throw new RuntimeException("Failed to get product: " + productId, e);
        }
    }
}
