const User = require("../../models/userSchema");
const cartController = require("../../controller/user/userController");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");

const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId).populate("cart.productId");
    const cart = user.cart.map(item => ({
      productId: item.productId._id,
      name: item.productId.name,
      image: item.productId.image,
      price: item.productId.price,
      quantity: item.quantity,
    }));
    res.render("addToCart", { cart, message: req.query.message ? decodeURIComponent(req.query.message) : null });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.redirect("/errorpage?message=cart-fetch-error");
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
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
      cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * product.salePrice;
    } else {
      cart.items.push({
        productId,
        quantity,
        price: product.salePrice,
        totalPrice: quantity * product.salePrice,
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

    // Check if user is logged in
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please log in to update cart' });
    }

    // Find the user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Find the item in the cart
    const item = cart.items.find(item => item.productId.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    // Fetch the product to check stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Validate quantity against stock and user limit
    const maxAllowedQuantity = Math.min(product.quantity, 5);
    if (quantity > maxAllowedQuantity) {
      return res.status(400).json({
        success: false,
        message: product.quantity < 5
          ? `Only ${product.quantity} items are available in stock.`
          : 'You cannot add more than 5 items of this product.',
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be less than 1.',
      });
    }

    // Update the quantity and totalPrice
    item.quantity = quantity;
    item.totalPrice = item.price * quantity;

    // Save the updated cart
    await cart.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating quantity:', error);
    res.status(500).json({ success: false, message: 'Server error while updating quantity' });
  }
};

module.exports = {
  getCart,
  updateCart,
 updateQuantity,
  addToCart,
  removeFromCart
};


