/**
 * Cart Routes - API endpoint definitions
 */
import { Router } from 'express';
import {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  transferCart,
  getGuestCart,
  addGuestItem,
  updateGuestItem,
  removeGuestItem,
  clearGuestCart,
} from '../controllers/cart.controller.js';

const router = Router();

// ============================================
// Authenticated User Cart Routes
// ============================================

// GET /api/v1/cart - Get user's cart
router.get('/api/v1/cart', getCart);

// POST /api/v1/cart/items - Add item to cart
router.post('/api/v1/cart/items', addItem);

// PUT /api/v1/cart/items/:sku - Update item quantity
router.put('/api/v1/cart/items/:sku', updateItem);

// DELETE /api/v1/cart/items/:sku - Remove item from cart
router.delete('/api/v1/cart/items/:sku', removeItem);

// DELETE /api/v1/cart - Clear cart
router.delete('/api/v1/cart', clearCart);

// POST /api/v1/cart/transfer - Transfer guest cart to user
router.post('/api/v1/cart/transfer', transferCart);

// ============================================
// Guest Cart Routes
// ============================================

// GET /api/v1/guest/cart/:guestId - Get guest cart
router.get('/api/v1/guest/cart/:guestId', getGuestCart);

// POST /api/v1/guest/cart/:guestId/items - Add item to guest cart
router.post('/api/v1/guest/cart/:guestId/items', addGuestItem);

// PUT /api/v1/guest/cart/:guestId/items/:sku - Update guest cart item
router.put('/api/v1/guest/cart/:guestId/items/:sku', updateGuestItem);

// DELETE /api/v1/guest/cart/:guestId/items/:sku - Remove item from guest cart
router.delete('/api/v1/guest/cart/:guestId/items/:sku', removeGuestItem);

// DELETE /api/v1/guest/cart/:guestId - Clear guest cart
router.delete('/api/v1/guest/cart/:guestId', clearGuestCart);

export default router;
