package com.xshopai.cartservice.security;

import io.smallrye.jwt.algorithm.SignatureAlgorithm;
import io.smallrye.jwt.auth.principal.JWTAuthContextInfo;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.Set;

/**
 * Provides JWT verification key for HS256 symmetric algorithm.
 * 
 * The secret is loaded from:
 * 1. Environment variable JWT_SECRET (injected by Azure Key Vault in production)
 * 2. Dapr secret store (fallback for local development)
 * 
 * This enables cart-service to validate JWTs issued by auth-service.
 */
@ApplicationScoped
public class JwtSecretKeyProvider {

    private static final Logger logger = Logger.getLogger(JwtSecretKeyProvider.class);

    @ConfigProperty(name = "JWT_SECRET", defaultValue = "")
    Optional<String> jwtSecretFromEnv;

    @ConfigProperty(name = "mp.jwt.verify.issuer")
    String issuer;

    @ConfigProperty(name = "mp.jwt.verify.audiences")
    Optional<String> audiences;

    private SecretKey secretKey;
    private boolean jwtEnabled = false;

    @PostConstruct
    void init() {
        String secret = jwtSecretFromEnv.orElse("");
        
        if (secret.isEmpty()) {
            logger.warn("JWT_SECRET not configured - JWT validation will be disabled. " +
                       "Set JWT_SECRET environment variable for production.");
            jwtEnabled = false;
            return;
        }

        try {
            // Create HMAC-SHA256 secret key from the shared secret
            byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
            this.secretKey = new SecretKeySpec(keyBytes, "HmacSHA256");
            this.jwtEnabled = true;
            
            logger.info("JWT validation enabled with HS256 algorithm");
            logger.infof("JWT issuer: %s", issuer);
            logger.infof("JWT audiences: %s", audiences.orElse("not configured"));
        } catch (Exception e) {
            logger.error("Failed to initialize JWT secret key", e);
            jwtEnabled = false;
        }
    }

    /**
     * Produces custom JWTAuthContextInfo for HS256 validation.
     * This overrides the default configuration to use symmetric key.
     */
    @Produces
    @ApplicationScoped
    public JWTAuthContextInfo customJwtContextInfo() {
        JWTAuthContextInfo contextInfo = new JWTAuthContextInfo();
        
        if (!jwtEnabled || secretKey == null) {
            logger.warn("JWT not enabled - returning default context (validation will fail)");
            return contextInfo;
        }

        // Configure for HS256 symmetric algorithm
        contextInfo.setSignatureAlgorithm(SignatureAlgorithm.HS256);
        contextInfo.setSecretVerificationKey(secretKey);
        contextInfo.setIssuedBy(issuer);
        
        // Set expected audiences
        audiences.ifPresent(aud -> {
            contextInfo.setExpectedAudience(Set.of(aud.split(",")));
        });

        // Token configuration
        contextInfo.setTokenHeader("Authorization");
        contextInfo.setTokenSchemes(Set.of("Bearer"));
        contextInfo.setRequireNamedPrincipal(false);
        
        // Clock skew tolerance (30 seconds)
        contextInfo.setClockSkew(30);
        
        logger.debug("JWT context configured for HS256 validation");
        return contextInfo;
    }

    public boolean isJwtEnabled() {
        return jwtEnabled;
    }
}
