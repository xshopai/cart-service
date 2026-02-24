# End-to-End Tests

E2E tests verify the entire cart service API flows work correctly from an external client perspective.

## Running E2E Tests

```bash
# Start the service
npm run dev:dapr

# In another terminal, run E2E tests
npm test -- --testPathPattern=e2e
```

## Test Scenarios

- Complete cart lifecycle (create, add items, update, remove, clear)
- Guest cart to user cart transfer
- Cart expiration handling
- Error scenarios and edge cases
