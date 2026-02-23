package com.xshopai.cartservice.health;

import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Liveness;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * Simple liveness check that only verifies the application is running.
 * Does not check Redis or other external dependencies.
 */
@Liveness
@ApplicationScoped
public class SimpleLivenessCheck implements HealthCheck {

    @Override
    public HealthCheckResponse call() {
        return HealthCheckResponse.up("cart-service");
    }
}
