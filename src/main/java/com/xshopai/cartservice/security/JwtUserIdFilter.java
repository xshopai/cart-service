package com.xshopai.cartservice.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

import java.io.IOException;

/**
 * Filter that extracts user information from validated JWT
 * and sets X-User-Id header for backward compatibility with existing code.
 * 
 * This allows the existing CartResource to continue using @HeaderParam("X-User-Id")
 * while we add JWT validation at the framework level.
 * 
 * Flow:
 * 1. Quarkus validates JWT (via JwtSecretKeyProvider)
 * 2. This filter extracts 'sub' claim (user ID) from JWT
 * 3. Sets X-User-Id header for downstream processing
 * 4. CartResource reads X-User-Id header as before
 */
@Provider
@Priority(Priorities.AUTHENTICATION + 1) // Run after JWT authentication
public class JwtUserIdFilter implements ContainerRequestFilter {

    private static final Logger logger = Logger.getLogger(JwtUserIdFilter.class);

    @Inject
    SecurityIdentity securityIdentity;

    @Inject
    JsonWebToken jwt;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        String path = requestContext.getUriInfo().getPath();
        
        // Skip for public endpoints
        if (isPublicPath(path)) {
            logger.debugf("Skipping JWT user extraction for public path: %s", path);
            return;
        }

        // Skip for guest endpoints
        if (path.contains("/guest/")) {
            logger.debugf("Skipping JWT user extraction for guest path: %s", path);
            return;
        }

        // Check if user is authenticated via JWT
        if (securityIdentity != null && !securityIdentity.isAnonymous()) {
            // Extract user ID from JWT 'sub' claim
            String userId = jwt.getSubject();
            
            if (userId != null && !userId.isEmpty()) {
                // Set X-User-Id header for backward compatibility
                // This allows existing code to work without modification
                requestContext.getHeaders().putSingle("X-User-Id", userId);
                
                logger.debugf("Set X-User-Id from JWT subject: %s for path: %s", userId, path);
                
                // Also log additional JWT claims for debugging
                if (logger.isDebugEnabled()) {
                    logger.debugf("JWT claims - email: %s, roles: %s", 
                        jwt.getClaim("email"),
                        jwt.getClaim("roles"));
                }
            } else {
                logger.warnf("JWT subject (sub) is empty for authenticated request to: %s", path);
            }
        } else {
            // For authenticated paths, if no JWT is present, the request will fail
            // with 401 at the Quarkus security layer before reaching CartResource
            logger.debugf("No authenticated identity for path: %s (will fail if protected)", path);
        }
    }

    private boolean isPublicPath(String path) {
        return path.equals("/") ||
               path.equals("") ||
               path.startsWith("/health") ||
               path.equals("/liveness") ||
               path.equals("/readiness") ||
               path.equals("/version") ||
               path.equals("/info") ||
               path.equals("/metrics") ||
               path.startsWith("/swagger") ||
               path.startsWith("/q/");
    }
}
