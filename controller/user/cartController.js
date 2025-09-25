const User = require("../../models/userSchema");
const cartController = require("../../controller/user/userController");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const mongoose = require('mongoose');

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId).populate("cart.productId");
    const cart = user.cart.map(item => ({
      productId: item.productId._id,
      name: item.productId.name,
      image: item.productId.image,
      price: item.productId.salePrice, 
      quantity: item.quantity,
    }));
    res.render("addToCart", { cart, message: req.query.message ? decodeURIComponent(req.query.message) : null });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.redirect("/page-404");
  }
};

const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    if (!productId || quantity < 1) {
      return res.status(400).json({ message: "Invalid product ID or quantity" });
    }

    const user = await User.findById(userId);
    const cartItem = user.cart.find(item => item.productId.toString() === productId);
    if (cartItem) {
      cartItem.quantity = quantity;
      await user.save();
      res.status(200).json({ message: "Cart updated" });
    } else {
      res.status(404).json({ message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ status: false, message: "User not logged in" });
    }

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ status: false, message: "Cart not found" });
    }

    const cartItemIndex = cart.items.findIndex(item => {
      const dbId = (item.productId._id || item.productId).toString();
      const reqId = productId.toString().trim();
      return dbId === reqId;
    });

    console.log("cartItemIndex", cartItemIndex);

    if (cartItemIndex === -1) {
      return res.status(404).json({ status: false, message: "Product not found in cart" });
    }

    // Remove the item
    cart.items.splice(cartItemIndex, 1);
    await cart.save();

    return res.json({ status: true, message: "Product removed from cart" });

  } catch (error) {
    console.error("Error in removeFromCart:", error);
    return res.status(500).json({ status: false, message: "An error occurred while removing the product from cart" });
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please log in to add to cart.' });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.stock} items in stock.` });
    }
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Use salePrice directly - it already has the discount applied
    const effectivePrice = product.salePrice;

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
      cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * effectivePrice;
    } else {
      cart.items.push({
        productId,
        quantity,
        price: effectivePrice,
        totalPrice: quantity * effectivePrice,
        image: product.productImage[0],
        name: product.productName,
      });

    }
    await cart.save();
    // Optionally update product stock
    product.stock -= quantity;
    await product.save();
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ message: "Product ID is required." });
        }

        let cart = req.session.cart || [];
        cart = cart.filter(item => item.productId !== productId);

        req.session.cart = cart;

        res.status(200).json({ message: "Item removed successfully." });
    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ message: "Server error." });
    }
};

const updateQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to update cart", redirect: "/login" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.error(`Invalid product ID: ${productId}`);
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      console.error(`Cart not found for user: ${userId}`);
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find(item => item.productId._id.toString() === productId);
    if (!item) {
      console.error(`Item not found in cart: ${productId}`);
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      console.error(`Product not found: ${productId}`);
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const maxAllowedQuantity = Math.min(product.quantity, 5);
    if (quantity > maxAllowedQuantity) {
      return res.status(400).json({
        success: false,
        message: product.quantity < 5
          ? `Only ${product.quantity} items are available in stock`
          : "You cannot add more than 5 items of this product"
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity cannot be less than 1"
      });
    }

    // Use salePrice directly - it already has the discount applied
    const effectivePrice = product.salePrice;
    
    item.quantity = quantity;
    item.price = effectivePrice;
    item.image = product.productImage[0] || "/placeholder.svg";
    item.name = product.productName;

    await cart.save();
    res.json({ success: true, price: effectivePrice });
  } catch (error) {
    console.error("Error updating quantity:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Server error updating quantity" });
  }
};

const refreshCart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in to view your cart",
        redirect: "/login"
      });
    }

    // Fetch and populate product details in cart items
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    console.log(cart)
    if (!cart) {
      return res.json({ success: true, cart: [], priceChanged: false });
    }

    let priceChanged = false;

    // Update each item's price and product details
    for (let item of cart.items) {
      if (!item.productId) {
        console.warn(`Skipping cart item ${item._id} due to missing product`);
        continue;
      }

      const product = item.productId; // Already populated

      // Use salePrice directly - it already has the discount applied
      const effectivePrice = product.salePrice;

      if (item.price !== effectivePrice) priceChanged = true;

      item.price = effectivePrice;
      item.image = product.productImage?.[0] || "/placeholder.svg";
      item.name = product.productName;
    }

    await cart.save();

    // Safely map only valid cart items
    const cartItems = cart.items
      .filter(item => item.productId)
      .map(item => ({
        productId: item.productId._id,
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        stock: item.productId.quantity
      }));

    res.json({ success: true, cart: cartItems, priceChanged });
  } catch (error) {
    console.error("Error refreshing cart:", error);
    res.status(500).json({
      success: false,
      message: "Server error refreshing cart"
    });
  }
};

module.exports = {
  getCart,
  updateCart,
  updateQuantity,
  addToCart,
  removeFromCart,
  refreshCart,
};