const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Category = require("../../models/categorySchema");

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;

    // Validate user session
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not logged in",
      });
    }

    // Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fetch cart items from the Cart model
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Fetch address details
    const addressData = await Address.findOne({ userId });
    if (!addressData) {
      return res.status(400).json({
        success: false,
        message: "Address not found",
      });
    }

    const selectedAddress = addressData.address.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: "Selected address not found",
      });
    }

    // Create separate orders for each cart item
    const orders = await Promise.all(
      cart.items.map(async (item) => {
        // Validate stock before placing the order
        if (!item.productId) {
          throw new Error("Product not found in cart item");
        }
        if (item.productId.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product ${item.productId.productName}`
          );
        }

        const order = new Order({
          orderId: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
          userId: userId,
          customerName: selectedAddress.name,
          orderDate: new Date(),
          totalAmount: item.totalPrice || item.quantity * (item.price || item.productId.salePrice),
          status: "pending",
          orderedItems: [
            {
              product: item.productId._id,
              quantity: item.quantity,
              status: "pending",
            },
          ],
          shippingAddress: `${selectedAddress.streetAddress}, ${selectedAddress.city}, ${selectedAddress.state}, ${selectedAddress.country}, ${selectedAddress.pincode}`,
        });

        // Update product stock
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { stock: -item.quantity },
        });

        return order.save();
      })
    );

    // Clear the cart
    cart.items = [];
    await cart.save();

    // Return success response
    res.json({
      success: true,
      orderIds: orders.map((order) => order.orderId),
      message: "Orders placed successfully",
    });
  } catch (error) {
    console.error("Error in placeOrder:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to place order",
    });
  }
};

const getOrders = async (req, res) => {
  try {
    const userId = req.session.user; // Use session-based user ID
    if (!userId) {
      return res.status(401).json({ error: "User not logged in" });
    }

    const orders = await Order.find({ userId })
      .sort({ orderDate: -1 }) // Sort by orderDate in descending order (newest first)
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage salePrice', // Match fields used in EJS
      });

    const user = await User.findById(userId);

    res.render("orders", {
      orders: orders,
      user: user,
    });
  } catch (error) {
    console.error("Error in getOrders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.query.orderId;

    const order = await Order.findOne({ orderId: orderId, userId })
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage price',
      });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const user = await User.findById(userId);

    res.render("order-details", {
      order,
      user,
    });
  } catch (error) {
    console.error("Error in loadOrderDetails:", error);
    res.status(500).send("Internal server error");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.session.user;

    // Validate inputs
    if (!orderId || !reason || reason.trim() === "") {
      return res.status(400).json({ success: false, message: "Order ID and cancellation reason are required" });
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    // Find the order
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check if the order can be cancelled
    if (order.status === "cancelled" || order.status === "delivered") {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled" });
    }

    // Update order status and reason
    order.status = "cancelled";
    order.cancelReason = reason;
    order.updatedOn = new Date();

    // Update each item in orderedItems
    for (const item of order.orderedItems) {
      item.status = "cancelled";
      item.cancelReason = reason;

      // Return product quantity to stock
      const productUpdate = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (!productUpdate) {
        console.log("Product not found for productId:", item.product, "Skipping stock update.");
        continue;
      }
    }

    await order.save();
    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  placeOrder,
  getOrders,
  loadOrderDetails,
  cancelOrder,
};