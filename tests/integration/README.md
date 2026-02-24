# Integration Tests

Integration tests verify that components work correctly together, typically with real (or containerized) dependencies.

## Running Integration Tests

```bash
# Ensure Redis is running
docker-compose -f docker-compose.db.yml up -d

# Run integration tests
npm test -- --testPathPattern=integration
```

## Test Scenarios

- Cart service with Dapr state store
- Pub/Sub event publishing
- Cart transfer between guest and authenticated users
