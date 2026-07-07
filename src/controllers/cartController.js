// src/controllers/cartController.js

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { successResponse, errorResponse } = require('../utils/responses');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private (Student)
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id })
      .populate('items.productId', 'name price images stock status');

    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] });
    }

    // Filter out unavailable products
    const validItems = cart.items.filter(item => 
      item.productId && 
      item.productId.status === 'active' && 
      item.productId.stock >= item.quantity
    );

    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    const total = cart.calculateTotal();
    const itemCount = cart.getItemCount();

    successResponse(res, {
      message: 'Cart retrieved successfully',
      data: {
        cart,
        summary: {
          itemCount,
          subtotal: total,
          platformFee: total * 0.10,
          total: total + (total * 0.10)
        }
      }
    });

  } catch (error) {
    console.error('Get cart error:', error);
    errorResponse(res, error.message || 'Failed to get cart', 500);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private (Student)
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity < 1) {
      return errorResponse(res, 'Invalid product or quantity', 400);
    }

    // Validate product
    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    if (product.status !== 'active') {
      return errorResponse(res, 'Product is not available', 400);
    }

    if (product.stock < quantity) {
      return errorResponse(res, 'Insufficient stock', 400);
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      if (product.stock < newQuantity) {
        return errorResponse(res, 'Insufficient stock for requested quantity', 400);
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.items.push({
        productId,
        quantity,
        price: product.price
      });
    }

    await cart.save();
    await cart.populate('items.productId', 'name price images stock status');

    const total = cart.calculateTotal();

    successResponse(res, {
      message: 'Item added to cart',
      data: {
        cart,
        summary: {
          itemCount: cart.getItemCount(),
          total
        }
      }
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    errorResponse(res, error.message || 'Failed to add to cart', 500);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/update/:itemId
// @access  Private (Student)
exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return errorResponse(res, 'Invalid quantity', 400);
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return errorResponse(res, 'Cart not found', 404);
    }

    const itemIndex = cart.items.findIndex(
      item => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return errorResponse(res, 'Item not found in cart', 404);
    }

    // Validate stock
    const product = await Product.findById(cart.items[itemIndex].productId);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    if (product.stock < quantity) {
      return errorResponse(res, 'Insufficient stock', 400);
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price; // Update price if changed

    await cart.save();
    await cart.populate('items.productId', 'name price images stock status');

    successResponse(res, {
      message: 'Cart updated successfully',
      data: {
        cart,
        summary: {
          itemCount: cart.getItemCount(),
          total: cart.calculateTotal()
        }
      }
    });

  } catch (error) {
    console.error('Update cart error:', error);
    errorResponse(res, error.message || 'Failed to update cart', 500);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:itemId
// @access  Private (Student)
exports.removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return errorResponse(res, 'Cart not found', 404);
    }

    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    await cart.save();

    await cart.populate('items.productId', 'name price images stock status');

    successResponse(res, {
      message: 'Item removed from cart',
      data: {
        cart,
        summary: {
          itemCount: cart.getItemCount(),
          total: cart.calculateTotal()
        }
      }
    });

  } catch (error) {
    console.error('Remove from cart error:', error);
    errorResponse(res, error.message || 'Failed to remove item', 500);
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Private (Student)
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return errorResponse(res, 'Cart not found', 404);
    }

    cart.items = [];
    await cart.save();

    successResponse(res, {
      message: 'Cart cleared successfully',
      data: { cart }
    });

  } catch (error) {
    console.error('Clear cart error:', error);
    errorResponse(res, error.message || 'Failed to clear cart', 500);
  }
};