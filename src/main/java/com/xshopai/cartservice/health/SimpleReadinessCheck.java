package com.xshopai.cartservice.health;

import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * Simple readiness check that only verifies the application is ready to serve requests.
 * Does not check external dependencies like Redis to avoid blocking health probes.
 */
@Readiness
@ApplicationScoped
public class SimpleReadinessCheck implements HealthCheck {

    @Override
    public HealthCheckResponse call() {
        return HealthCheckResponse.up("cart-service");
    }
}
