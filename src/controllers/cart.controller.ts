/**
 * Cart Controller - HTTP request handlers
 */
import { Request, Response, NextFunction } from 'express';
import logger from '../core/logger.js';
import { AppError, UnauthorizedError } from '../core/errors.js';
import {
  AddItemRequest,
  UpdateItemRequest,
  TransferCartRequest,
  successResponse,
  errorResponse,
} from '../models/cart.model.js';
import cartService from '../services/cart.service.js';

// Extend Express Request to include traceId
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      spanId?: string;
    }
  }
}

/**
 * Wrapper for async route handlers
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Get user ID from request headers
 */
const getUserId = (req: Request): string | null => {
  return (req.headers['x-user-id'] as string) || null;
};

// ============================================
// Authenticated User Cart Endpoints
// ============================================

/**
 * GET /api/v1/cart - Get authenticated user's cart
 */
export const getCart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json(errorResponse('User not authenticated'));
    return;
  }

  const cart = await cartService.getCart(userId);
  res.json(successResponse('Cart retrieved successfully', cart));
});

/**
 * POST /api/v1/cart/items - Add item to authenticated user's cart
 */
export const addItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json(errorResponse('User not authenticated'));
    return;
  }

  const request: AddItemRequest = req.body;
  const cart = await cartService.addItem(userId, request, false);
  res.json(successResponse('Item added to cart successfully', cart));
});

/**
 * PUT /api/v1/cart/items/:sku - Update item quantity
 */
export const updateItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json(errorResponse('User not authenticated'));
    return;
  }

  const { sku } = req.params;
  const { quantity }: UpdateItemRequest = req.body;

  const cart = await cartService.updateItemQuantity(userId, sku, quantity);
  res.json(successResponse('Item updated successfully', cart));
});

/**
 * DELETE /api/v1/cart/items/:sku - Remove item from cart
 */
export const removeItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json(errorResponse('User not authenticated'));
    return;
  }

  const { sku } = req.params;
  const cart = await cartService.removeItem(userId, sku);
  res.json(successResponse('Item removed successfully', cart));
});

/**
 * DELETE /api/v1/cart - Clear cart
 */
export const clearCart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json(errorResponse('User not authenticated'));
    return;
  }

  await cartService.clearCart(userId);
  res.json(successResponse('Cart cleared successfully', null));
});

/**
 * POST /api/v1/cart/transfer - Transfer guest cart to authenticated user
 */
export const transferCart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json(errorResponse('User not authenticated'));
    return;
  }

  const { guestId }: TransferCartRequest = req.body;

  if (!guestId) {
    res.status(400).json(errorResponse('Guest ID is required'));
    return;
  }

  const cart = await cartService.transferCart(guestId, userId);
  res.json(successResponse('Cart transferred successfully', cart));
});

// ============================================
// Guest Cart Endpoints
// ============================================

/**
 * GET /api/v1/guest/cart/:guestId - Get guest cart
 */
export const getGuestCart = asyncHandler(async (req: Request, res: Response) => {
  const { guestId } = req.params;
  const cart = await cartService.getCart(guestId);
  res.json(successResponse('Cart retrieved successfully', cart));
});

/**
 * POST /api/v1/guest/cart/:guestId/items - Add item to guest cart
 */
export const addGuestItem = asyncHandler(async (req: Request, res: Response) => {
  const { guestId } = req.params;
  const request: AddItemRequest = req.body;
  const cart = await cartService.addItem(guestId, request, true);
  res.json(successResponse('Item added to cart successfully', cart));
});

/**
 * PUT /api/v1/guest/cart/:guestId/items/:sku - Update guest cart item quantity
 */
export const updateGuestItem = asyncHandler(async (req: Request, res: Response) => {
  const { guestId, sku } = req.params;
  const { quantity }: UpdateItemRequest = req.body;
  const cart = await cartService.updateItemQuantity(guestId, sku, quantity);
  res.json(successResponse('Item updated successfully', cart));
});

/**
 * DELETE /api/v1/guest/cart/:guestId/items/:sku - Remove item from guest cart
 */
export const removeGuestItem = asyncHandler(async (req: Request, res: Response) => {
  const { guestId, sku } = req.params;
  const cart = await cartService.removeItem(guestId, sku);
  res.json(successResponse('Item removed successfully', cart));
});

/**
 * DELETE /api/v1/guest/cart/:guestId - Clear guest cart
 */
export const clearGuestCart = asyncHandler(async (req: Request, res: Response) => {
  const { guestId } = req.params;
  await cartService.clearCart(guestId);
  res.json(successResponse('Cart cleared successfully', null));
});

// ============================================
// Error Handler
// ============================================

/**
 * Global error handler middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    traceId: req.traceId,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  // Default error
  res.status(500).json(errorResponse('Internal server error'));
};
