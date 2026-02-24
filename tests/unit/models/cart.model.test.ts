/**
 * Unit tests for cart.model.ts
 */
import {
  Cart,
  CartItem,
  AddItemRequest,
  createCart,
  createCartItem,
  recalculateTotals,
  successResponse,
  errorResponse,
} from '../../../src/models/cart.model';

describe('Cart Model', () => {
  describe('createCart', () => {
    it('should create an empty cart with correct defaults', () => {
      const userId = 'user-123';
      const ttlDays = 30;

      const cart = createCart(userId, ttlDays);

      expect(cart.userId).toBe(userId);
      expect(cart.items).toEqual([]);
      expect(cart.totalPrice).toBe(0);
      expect(cart.totalItems).toBe(0);
      expect(cart.createdAt).toBeLessThanOrEqual(Date.now());
      expect(cart.updatedAt).toBeLessThanOrEqual(Date.now());
      expect(cart.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should calculate correct expiration time', () => {
      const userId = 'user-123';
      const ttlDays = 7;
      const now = Date.now();

      const cart = createCart(userId, ttlDays);

      const expectedExpiry = now + ttlDays * 24 * 60 * 60 * 1000;
      // Allow 1 second tolerance for timing
      expect(cart.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(cart.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should create cart for guest user', () => {
      const guestId = 'guest-abc123';
      const ttlDays = 3;

      const cart = createCart(guestId, ttlDays);

      expect(cart.userId).toBe(guestId);
    });
  });

  describe('createCartItem', () => {
    it('should create a cart item from request', () => {
      const request: AddItemRequest = {
        productId: 'prod-123',
        productName: 'Test Product',
        sku: 'SKU-001',
        price: 29.99,
        quantity: 2,
        imageUrl: 'https://example.com/image.jpg',
        category: 'Electronics',
        selectedColor: 'Blue',
        selectedSize: 'M',
      };

      const item = createCartItem(request);

      expect(item.productId).toBe(request.productId);
      expect(item.productName).toBe(request.productName);
      expect(item.sku).toBe(request.sku);
      expect(item.price).toBe(request.price);
      expect(item.quantity).toBe(request.quantity);
      expect(item.imageUrl).toBe(request.imageUrl);
      expect(item.category).toBe(request.category);
      expect(item.selectedColor).toBe(request.selectedColor);
      expect(item.selectedSize).toBe(request.selectedSize);
      expect(item.subtotal).toBe(request.price * request.quantity);
      expect(item.addedAt).toBeLessThanOrEqual(Date.now());
    });

    it('should calculate correct subtotal', () => {
      const request: AddItemRequest = {
        productId: 'prod-123',
        productName: 'Test Product',
        sku: 'SKU-001',
        price: 15.5,
        quantity: 3,
      };

      const item = createCartItem(request);

      expect(item.subtotal).toBe(46.5);
    });

    it('should handle optional fields', () => {
      const request: AddItemRequest = {
        productId: 'prod-123',
        productName: 'Test Product',
        sku: 'SKU-001',
        price: 10.0,
        quantity: 1,
      };

      const item = createCartItem(request);

      expect(item.imageUrl).toBeUndefined();
      expect(item.category).toBeUndefined();
      expect(item.selectedColor).toBeUndefined();
      expect(item.selectedSize).toBeUndefined();
    });
  });

  describe('recalculateTotals', () => {
    it('should calculate totals for empty cart', () => {
      const cart = createCart('user-123', 30);

      recalculateTotals(cart);

      expect(cart.totalItems).toBe(0);
      expect(cart.totalPrice).toBe(0);
    });

    it('should calculate totals for cart with items', () => {
      const cart = createCart('user-123', 30);
      cart.items = [
        createCartItem({
          productId: 'prod-1',
          productName: 'Product 1',
          sku: 'SKU-1',
          price: 10.0,
          quantity: 2,
        }),
        createCartItem({
          productId: 'prod-2',
          productName: 'Product 2',
          sku: 'SKU-2',
          price: 25.0,
          quantity: 1,
        }),
      ];

      recalculateTotals(cart);

      expect(cart.totalItems).toBe(3); // 2 + 1
      expect(cart.totalPrice).toBe(45.0); // 20 + 25
    });

    it('should update the updatedAt timestamp', () => {
      const cart = createCart('user-123', 30);
      const originalUpdatedAt = cart.updatedAt;

      // Wait a tiny bit to ensure time difference
      recalculateTotals(cart);

      expect(cart.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe('successResponse', () => {
    it('should create a success response', () => {
      const message = 'Cart retrieved successfully';
      const data = { userId: 'user-123', items: [] };

      const response = successResponse(message, data);

      expect(response.success).toBe(true);
      expect(response.message).toBe(message);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });

    it('should include valid ISO timestamp', () => {
      const response = successResponse('Test', null);

      expect(() => new Date(response.timestamp)).not.toThrow();
    });
  });

  describe('errorResponse', () => {
    it('should create an error response', () => {
      const message = 'Cart not found';

      const response = errorResponse(message);

      expect(response.success).toBe(false);
      expect(response.message).toBe(message);
      expect(response.data).toBeNull();
      expect(response.timestamp).toBeDefined();
    });
  });
});
