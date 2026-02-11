package com.xshopai.cartservice.security;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.util.Optional;

/**
 * Service Token Filter
 * 
 * Validates service-to-service communication using X-Service-Token header.
 * Applied to internal API endpoints that should only be called by other services.
 * 
 * Path Protection:
 * - /api/internal/* - Requires valid service token
 * - All other paths - No service token required (uses JWT for user auth)
 * 
 * Configuration:
 * - service.token.enabled=true (default)
 * - service.token.value=<secret-token> (from environment or secrets)
 */
@Provider
@ApplicationScoped
@Priority(Priorities.AUTHENTICATION - 50) // Run before JWT auth
public class ServiceTokenFilter implements ContainerRequestFilter {
    
    private static final Logger logger = Logger.getLogger(ServiceTokenFilter.class);
    
    private static final String SERVICE_TOKEN_HEADER = "X-Service-Token";
    private static final String INTERNAL_API_PATH_PREFIX = "/api/internal";
    
    @ConfigProperty(name = "service.token.enabled", defaultValue = "true")
    boolean serviceTokenEnabled;
    
    @ConfigProperty(name = "service.token.value")
    Optional<String> expectedServiceToken;
    
    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        // Skip if service token validation is disabled
        if (!serviceTokenEnabled) {
            return;
        }
        
        // Only validate internal API paths
        String path = requestContext.getUriInfo().getPath();
        if (!path.startsWith(INTERNAL_API_PATH_PREFIX)) {
            return;
        }
        
        // Check if service token is configured
        if (expectedServiceToken.isEmpty() || expectedServiceToken.get().isEmpty()) {
            logger.warn("Service token validation enabled but no token configured - denying request");
            abortWithUnauthorized(requestContext, "Service token not configured");
            return;
        }
        
        // Extract service token from header
        String providedToken = requestContext.getHeaderString(SERVICE_TOKEN_HEADER);
        
        if (providedToken == null || providedToken.isEmpty()) {
            logger.warnf("Service token missing for internal API: %s", path);
            abortWithUnauthorized(requestContext, "Service token required for internal APIs");
            return;
        }
        
        // Validate service token
        if (!expectedServiceToken.get().equals(providedToken)) {
            logger.errorf("Invalid service token for internal API: %s", path);
            abortWithUnauthorized(requestContext, "Invalid service token");
            return;
        }
        
        // Token valid - proceed with request
        logger.debugf("Service token validated successfully for: %s", path);
    }
    
    private void abortWithUnauthorized(ContainerRequestContext requestContext, String message) {
        requestContext.abortWith(
            Response.status(Response.Status.UNAUTHORIZED)
                .entity(new ErrorResponse("UNAUTHORIZED", message))
                .build()
        );
    }
    
    /**
     * Simple error response structure
     */
    private static class ErrorResponse {
        public String error;
        public String message;
        
        public ErrorResponse(String error, String message) {
            this.error = error;
            this.message = message;
        }
    }
}
