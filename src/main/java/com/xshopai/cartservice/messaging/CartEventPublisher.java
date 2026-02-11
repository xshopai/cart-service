package com.xshopai.cartservice.messaging;

import com.xshopai.cartservice.model.Cart;
import com.xshopai.cartservice.model.CartItem;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Cart Event Publisher
 * 
 * Publishes cart-related domain events for event-driven architecture.
 * Uses pluggable MessagingProvider for broker abstraction.
 * 
 * Published Events:
 * - cart.item.added - Item added to cart
 * - cart.item.updated - Item quantity changed
 * - cart.item.removed - Item removed from cart
 * - cart.cleared - Cart emptied
 * - cart.transferred - Guest cart merged to user cart
 * - cart.checkout.started - Checkout process initiated
 */
@ApplicationScoped
public class CartEventPublisher {
    
    @Inject
    Logger logger;
    
    @Inject
    MessagingProvider messagingProvider;
    
    /**
     * Publish cart.item.added event
     */
    public void publishItemAdded(Cart cart, CartItem addedItem, String correlationId) {
        try {
            Map<String, Object> eventData = buildItemEventData(cart, addedItem);
            
            boolean success = messagingProvider.publishEvent(
                "cart.item.added",
                eventData,
                correlationId
            );
            
            if (success) {
                logger.infof("Published cart.item.added event: userId=%s, productId=%s, correlationId=%s",
                    cart.getUserId(), addedItem.getProductId(), correlationId);
            } else {
                logger.warnf("Failed to publish cart.item.added event: userId=%s, productId=%s",
                    cart.getUserId(), addedItem.getProductId());
            }
        } catch (Exception e) {
            // Log but don't fail the operation - event publishing is non-critical
            logger.errorf("Error publishing cart.item.added event: %s", e.getMessage());
        }
    }
    
    /**
     * Publish cart.item.updated event
     */
    public void publishItemUpdated(Cart cart, String sku, int oldQuantity, int newQuantity, String correlationId) {
        try {
            CartItem updatedItem = cart.getItems().stream()
                .filter(item -> item.getSku().equals(sku))
                .findFirst()
                .orElse(null);
            
            if (updatedItem == null) {
                logger.warnf("Cannot publish cart.item.updated - item not found: sku=%s", sku);
                return;
            }
            
            Map<String, Object> eventData = buildItemEventData(cart, updatedItem);
            eventData.put("oldQuantity", oldQuantity);
            eventData.put("newQuantity", newQuantity);
            eventData.put("quantityChange", newQuantity - oldQuantity);
            
            boolean success = messagingProvider.publishEvent(
                "cart.item.updated",
                eventData,
                correlationId
            );
            
            if (success) {
                logger.infof("Published cart.item.updated event: userId=%s, sku=%s, %d→%d, correlationId=%s",
                    cart.getUserId(), sku, oldQuantity, newQuantity, correlationId);
            }
        } catch (Exception e) {
            logger.errorf("Error publishing cart.item.updated event: %s", e.getMessage());
        }
    }
    
    /**
     * Publish cart.item.removed event
     */
    public void publishItemRemoved(Cart cart, String sku, CartItem removedItem, String correlationId) {
        try {
            Map<String, Object> eventData = new HashMap<>();
            eventData.put("userId", cart.getUserId());
            eventData.put("cartId", cart.getUserId());
            eventData.put("sku", sku);
            eventData.put("productId", removedItem != null ? removedItem.getProductId() : null);
            eventData.put("productName", removedItem != null ? removedItem.getProductName() : null);
            eventData.put("quantity", removedItem != null ? removedItem.getQuantity() : 0);
            eventData.put("price", removedItem != null ? removedItem.getPrice() : 0.0);
            eventData.put("timestamp", System.currentTimeMillis());
            
            // Cart summary after removal
            eventData.put("cartItemCount", cart.getItems().size());
            eventData.put("cartTotalAmount", cart.getTotalPrice());
            
            boolean success = messagingProvider.publishEvent(
                "cart.item.removed",
                eventData,
                correlationId
            );
            
            if (success) {
                logger.infof("Published cart.item.removed event: userId=%s, sku=%s, correlationId=%s",
                    cart.getUserId(), sku, correlationId);
            }
        } catch (Exception e) {
            logger.errorf("Error publishing cart.item.removed event: %s", e.getMessage());
        }
    }
    
    /**
     * Publish cart.cleared event
     */
    public void publishCartCleared(String userId, int itemCount, double totalAmount, String correlationId) {
        try {
            Map<String, Object> eventData = new HashMap<>();
            eventData.put("userId", userId);
            eventData.put("cartId", userId);
            eventData.put("clearedItemCount", itemCount);
            eventData.put("clearedTotalAmount", totalAmount);
            eventData.put("timestamp", System.currentTimeMillis());
            
            boolean success = messagingProvider.publishEvent(
                "cart.cleared",
                eventData,
                correlationId
            );
            
            if (success) {
                logger.infof("Published cart.cleared event: userId=%s, items=%d, correlationId=%s",
                    userId, itemCount, correlationId);
            }
        } catch (Exception e) {
            logger.errorf("Error publishing cart.cleared event: %s", e.getMessage());
        }
    }
    
    /**
     * Publish cart.transferred event (guest → user)
     */
    public void publishCartTransferred(String guestId, String userId, int transferredItems, String correlationId) {
        try {
            Map<String, Object> eventData = new HashMap<>();
            eventData.put("fromGuestId", guestId);
            eventData.put("toUserId", userId);
            eventData.put("transferredItemCount", transferredItems);
            eventData.put("timestamp", System.currentTimeMillis());
            
            boolean success = messagingProvider.publishEvent(
                "cart.transferred",
                eventData,
                correlationId
            );
            
            if (success) {
                logger.infof("Published cart.transferred event: %s→%s, items=%d, correlationId=%s",
                    guestId, userId, transferredItems, correlationId);
            }
        } catch (Exception e) {
            logger.errorf("Error publishing cart.transferred event: %s", e.getMessage());
        }
    }
    
    /**
     * Publish cart.checkout.started event
     */
    public void publishCheckoutStarted(Cart cart, String correlationId) {
        try {
            Map<String, Object> eventData = new HashMap<>();
            eventData.put("userId", cart.getUserId());
            eventData.put("cartId", cart.getUserId());
            eventData.put("itemCount", cart.getItems().size());
            eventData.put("totalAmount", cart.getTotalPrice());
            eventData.put("timestamp", System.currentTimeMillis());
            
            // Include item SKUs for inventory reservation
            eventData.put("items", cart.getItems().stream()
                .map(item -> {
                    Map<String, Object> itemData = new HashMap<>();
                    itemData.put("sku", item.getSku());
                    itemData.put("productId", item.getProductId());
                    itemData.put("quantity", item.getQuantity());
                    itemData.put("price", item.getPrice());
                    return itemData;
                })
                .collect(Collectors.toList()));
            
            boolean success = messagingProvider.publishEvent(
                "cart.checkout.started",
                eventData,
                correlationId
            );
            
            if (success) {
                logger.infof("Published cart.checkout.started event: userId=%s, items=%d, total=%.2f, correlationId=%s",
                    cart.getUserId(), cart.getItems().size(), cart.getTotalPrice(), correlationId);
            }
        } catch (Exception e) {
            logger.errorf("Error publishing cart.checkout.started event: %s", e.getMessage());
        }
    }
    
    /**
     * Build common event data for item operations
     */
    private Map<String, Object> buildItemEventData(Cart cart, CartItem item) {
        Map<String, Object> eventData = new HashMap<>();
        
        // Cart identification
        eventData.put("userId", cart.getUserId());
        eventData.put("cartId", cart.getUserId());
        
        // Item details
        eventData.put("sku", item.getSku());
        eventData.put("productId", item.getProductId());
        eventData.put("productName", item.getProductName());
        eventData.put("quantity", item.getQuantity());
        eventData.put("price", item.getPrice());
        eventData.put("category", item.getCategory());
        eventData.put("imageUrl", item.getImageUrl());
        
        // Variant details (if present)
        if (item.getSelectedColor() != null) {
            eventData.put("selectedColor", item.getSelectedColor());
        }
        if (item.getSelectedSize() != null) {
            eventData.put("selectedSize", item.getSelectedSize());
        }
        
        // Cart summary
        eventData.put("cartItemCount", cart.getItems().size());
        eventData.put("cartTotalAmount", cart.getTotalPrice());
        
        // Timestamp
        eventData.put("timestamp", System.currentTimeMillis());
        
        return eventData;
    }
}
