# Unit Tests

This folder contains unit tests for the cart service components.

## Structure

- `models/` - Tests for data models and helper functions
- `services/` - Tests for business logic services (with mocked dependencies)
- `controllers/` - Tests for HTTP request handlers (with mocked services)

## Running Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Writing Tests

- Mock external dependencies (Dapr SDK, etc.)
- Test edge cases and error conditions
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
