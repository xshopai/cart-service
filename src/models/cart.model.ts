/**
 * Cart and CartItem type definitions
 */

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  category?: string;
  subtotal: number;
  selectedColor?: string;
  selectedSize?: string;
  addedAt: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface AddItemRequest {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  category?: string;
  selectedColor?: string;
  selectedSize?: string;
}

export interface UpdateItemRequest {
  quantity: number;
}

export interface TransferCartRequest {
  guestId: string;
}

export interface CartResponse<T = Cart | null> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Create a new empty cart
 */
export function createCart(userId: string, ttlDays: number): Cart {
  const now = Date.now();
  return {
    userId,
    items: [],
    totalPrice: 0,
    totalItems: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlDays * 24 * 60 * 60 * 1000,
  };
}

/**
 * Create a new cart item
 */
export function createCartItem(request: AddItemRequest): CartItem {
  return {
    productId: request.productId,
    productName: request.productName,
    sku: request.sku,
    price: request.price,
    quantity: request.quantity,
    imageUrl: request.imageUrl,
    category: request.category,
    subtotal: request.price * request.quantity,
    selectedColor: request.selectedColor,
    selectedSize: request.selectedSize,
    addedAt: Date.now(),
  };
}

/**
 * Recalculate cart totals
 */
export function recalculateTotals(cart: Cart): void {
  cart.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  cart.totalPrice = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
  cart.updatedAt = Date.now();
}

/**
 * Build a successful response
 */
export function successResponse<T>(message: string, data: T): CartResponse<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build an error response
 */
export function errorResponse(message: string): CartResponse<null> {
  return {
    success: false,
    message,
    data: null,
    timestamp: new Date().toISOString(),
  };
}
