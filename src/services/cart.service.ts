/**
 * Cart Service - Business logic for cart operations
 */
import config from '../core/config.js';
import logger from '../core/logger.js';
import { BadRequestError, NotFoundError } from '../core/errors.js';
import { Cart, CartItem, AddItemRequest, createCart, createCartItem, recalculateTotals } from '../models/cart.model.js';
import daprService from './dapr.service.js';

class CartService {
  private readonly maxItems: number;
  private readonly maxItemQuantity: number;
  private readonly ttlDays: number;
  private readonly guestTtlDays: number;

  constructor() {
    this.maxItems = config.cart.maxItems;
    this.maxItemQuantity = config.cart.maxItemQuantity;
    this.ttlDays = config.cart.ttlDays;
    this.guestTtlDays = config.cart.guestTtlDays;
  }

  /**
   * Get cart for a user (creates empty cart if not exists)
   */
  async getCart(userId: string): Promise<Cart> {
    logger.debug('Getting cart', { userId });

    let cart = await daprService.getState(userId);

    if (!cart) {
      // Create new empty cart
      const isGuest = userId.startsWith('guest-');
      const ttl = isGuest ? this.guestTtlDays : this.ttlDays;
      cart = createCart(userId, ttl);
      await daprService.saveState(cart);

      logger.info('Created new cart', { userId, isGuest, ttlDays: ttl });
    }

    return cart;
  }

  /**
   * Add item to cart
   */
  async addItem(userId: string, request: AddItemRequest, isGuest: boolean = false): Promise<Cart> {
    logger.debug('Adding item to cart', { userId, sku: request.sku, quantity: request.quantity });

    // Validate request
    if (!request.productId || !request.sku || !request.price || !request.quantity) {
      throw new BadRequestError('Missing required fields: productId, sku, price, quantity');
    }

    if (request.quantity <= 0) {
      throw new BadRequestError('Quantity must be greater than 0');
    }

    if (request.price < 0) {
      throw new BadRequestError('Price cannot be negative');
    }

    // Get or create cart
    let cart = await daprService.getState(userId);

    if (!cart) {
      const ttl = isGuest ? this.guestTtlDays : this.ttlDays;
      cart = createCart(userId, ttl);
    }

    // Check if item already exists (by SKU)
    const existingItemIndex = cart.items.findIndex((item) => item.sku === request.sku);

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + request.quantity;

      // Check max quantity per item
      if (newQuantity > this.maxItemQuantity) {
        throw new BadRequestError(`Maximum quantity per item (${this.maxItemQuantity}) exceeded`);
      }

      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.quantity * existingItem.price;

      logger.debug('Updated existing item quantity', {
        userId,
        sku: request.sku,
        newQuantity: existingItem.quantity,
      });
    } else {
      // Check max items limit
      if (cart.items.length >= this.maxItems) {
        throw new BadRequestError(`Maximum number of items (${this.maxItems}) exceeded`);
      }

      // Check max quantity per item
      if (request.quantity > this.maxItemQuantity) {
        throw new BadRequestError(`Maximum quantity per item (${this.maxItemQuantity}) exceeded`);
      }

      // Add new item
      const newItem = createCartItem(request);
      cart.items.push(newItem);

      logger.debug('Added new item to cart', { userId, sku: request.sku });
    }

    // Recalculate totals and save
    recalculateTotals(cart);
    await daprService.saveState(cart);

    // Find the added/updated item for event
    const addedItem = cart.items.find((item) => item.sku === request.sku);

    // Publish event with comprehensive data matching Quarkus implementation
    await daprService.publishEvent('cart.item.added', {
      userId,
      cartId: userId,
      productId: request.productId,
      productName: request.productName || '',
      sku: request.sku,
      price: request.price,
      quantity: addedItem?.quantity || request.quantity,
      subtotal: addedItem?.subtotal || request.price * request.quantity,
      category: request.category || '',
      imageUrl: request.imageUrl || '',
      selectedColor: request.selectedColor || null,
      selectedSize: request.selectedSize || null,
      timestamp: Date.now(),
      cartItemCount: cart.totalItems,
      cartTotalAmount: cart.totalPrice,
    });

    logger.info('Item added to cart', {
      userId,
      sku: request.sku,
      cartTotal: cart.totalPrice,
      cartItemCount: cart.totalItems,
    });

    return cart;
  }

  /**
   * Update item quantity in cart
   */
  async updateItemQuantity(userId: string, sku: string, quantity: number): Promise<Cart> {
    logger.debug('Updating item quantity', { userId, sku, quantity });

    if (quantity < 0) {
      throw new BadRequestError('Quantity cannot be negative');
    }

    if (quantity > this.maxItemQuantity) {
      throw new BadRequestError(`Maximum quantity per item (${this.maxItemQuantity}) exceeded`);
    }

    const cart = await daprService.getState(userId);

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const itemIndex = cart.items.findIndex((item) => item.sku === sku);

    if (itemIndex < 0) {
      throw new NotFoundError(`Item with SKU ${sku} not found in cart`);
    }

    if (quantity === 0) {
      // Remove item
      const removedItem = cart.items.splice(itemIndex, 1)[0];

      logger.debug('Removed item from cart', { userId, sku });

      // Publish event with comprehensive data
      await daprService.publishEvent('cart.item.removed', {
        userId,
        cartId: userId,
        productId: removedItem.productId,
        productName: removedItem.productName || '',
        sku: removedItem.sku,
        quantity: removedItem.quantity,
        price: removedItem.price,
        timestamp: Date.now(),
        cartItemCount: cart.totalItems,
        cartTotalAmount: cart.totalPrice,
      });
    } else {
      // Update quantity
      const item = cart.items[itemIndex];
      const oldQuantity = item.quantity;
      item.quantity = quantity;
      item.subtotal = item.quantity * item.price;

      logger.debug('Updated item quantity', { userId, sku, oldQuantity, newQuantity: quantity });

      // Publish event with comprehensive data
      await daprService.publishEvent('cart.item.updated', {
        userId,
        cartId: userId,
        productId: item.productId,
        productName: item.productName || '',
        sku: item.sku,
        oldQuantity,
        newQuantity: quantity,
        quantityChange: quantity - oldQuantity,
        price: item.price,
        subtotal: item.subtotal,
        timestamp: Date.now(),
        cartItemCount: cart.totalItems,
        cartTotalAmount: cart.totalPrice,
      });
    }

    // Recalculate totals and save
    recalculateTotals(cart);
    await daprService.saveState(cart);

    logger.info('Cart item updated', {
      userId,
      sku,
      quantity,
      cartTotal: cart.totalPrice,
      cartItemCount: cart.totalItems,
    });

    return cart;
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: string, sku: string): Promise<Cart> {
    logger.debug('Removing item from cart', { userId, sku });

    const cart = await daprService.getState(userId);

    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const itemIndex = cart.items.findIndex((item) => item.sku === sku);

    if (itemIndex < 0) {
      throw new NotFoundError(`Item with SKU ${sku} not found in cart`);
    }

    const removedItem = cart.items.splice(itemIndex, 1)[0];

    // Recalculate totals and save
    recalculateTotals(cart);
    await daprService.saveState(cart);

    // Publish event with comprehensive data
    await daprService.publishEvent('cart.item.removed', {
      userId,
      cartId: userId,
      productId: removedItem.productId,
      productName: removedItem.productName || '',
      sku: removedItem.sku,
      quantity: removedItem.quantity,
      price: removedItem.price,
      timestamp: Date.now(),
      cartItemCount: cart.totalItems,
      cartTotalAmount: cart.totalPrice,
    });

    logger.info('Item removed from cart', {
      userId,
      sku,
      cartTotal: cart.totalPrice,
      cartItemCount: cart.totalItems,
    });

    return cart;
  }

  /**
   * Clear all items from cart
   */
  async clearCart(userId: string): Promise<void> {
    logger.debug('Clearing cart', { userId });

    // Get cart details before clearing for event payload
    const cart = await daprService.getState(userId);
    const itemCount = cart?.items?.length || 0;
    const totalAmount = cart?.totalPrice || 0;

    await daprService.deleteState(userId);

    // Publish event with comprehensive data matching Quarkus implementation
    await daprService.publishEvent('cart.cleared', {
      userId,
      cartId: userId,
      clearedItemCount: itemCount,
      clearedTotalAmount: totalAmount,
      timestamp: Date.now(),
    });

    logger.info('Cart cleared', { userId, clearedItemCount: itemCount });
  }

  /**
   * Transfer guest cart to authenticated user
   */
  async transferCart(guestId: string, userId: string): Promise<Cart> {
    logger.debug('Transferring cart', { guestId, userId });

    // Get guest cart
    const guestCart = await daprService.getState(guestId);

    if (!guestCart || guestCart.items.length === 0) {
      logger.debug('No guest cart to transfer', { guestId, userId });
      return this.getCart(userId);
    }

    // Get or create user cart
    let userCart = await daprService.getState(userId);

    if (!userCart) {
      userCart = createCart(userId, this.ttlDays);
    }

    // Merge items from guest cart to user cart
    for (const guestItem of guestCart.items) {
      const existingIndex = userCart.items.findIndex((item) => item.sku === guestItem.sku);

      if (existingIndex >= 0) {
        // Add quantities
        userCart.items[existingIndex].quantity += guestItem.quantity;
        userCart.items[existingIndex].subtotal =
          userCart.items[existingIndex].quantity * userCart.items[existingIndex].price;
      } else if (userCart.items.length < this.maxItems) {
        // Add new item
        userCart.items.push({ ...guestItem });
      }
    }

    // Recalculate totals
    recalculateTotals(userCart);

    // Update expiration for authenticated user
    userCart.expiresAt = Date.now() + this.ttlDays * 24 * 60 * 60 * 1000;

    // Save user cart and delete guest cart
    await daprService.saveState(userCart);
    await daprService.deleteState(guestId);

    // Publish event with comprehensive data matching Quarkus implementation
    await daprService.publishEvent('cart.transferred', {
      fromGuestId: guestId,
      toUserId: userId,
      transferredItemCount: guestCart.items.length,
      timestamp: Date.now(),
    });

    logger.info('Cart transferred', {
      guestId,
      userId,
      itemsTransferred: guestCart.items.length,
      cartTotal: userCart.totalPrice,
    });

    return userCart;
  }
}

// Export singleton instance
export const cartService = new CartService();
export default cartService;
