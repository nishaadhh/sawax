// admin/orderController.js
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "orderedItems.product",
        select: "productName productImage salePrice stock",
      })
      .populate({
        path: "userId",
        select: "name",
      })
      .sort({ orderDate: -1 });

    res.render("admin-orders", {
      orders,
      title: "Order Management",
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate({
        path: "orderedItems.product",
        select: "productName productImage salePrice stock",
      })
      .populate({
        path: "userId",
        select: "name",
      });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("admin-order-details", {
      order,
      title: "Order Details",
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).send("Internal Server Error");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Don't allow status change if order is cancelled
    if (order.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot update cancelled order" });
    }

    // Update order status and related fields
    order.status = status;
    order.updatedOn = new Date();

    if (status === "delivered") {
      order.deliveredOn = new Date();
    }

    // Update each item in orderedItems
    for (const item of order.orderedItems) {
      item.status = status;
    }

    await order.save();
    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled" });
    }

    // Validate cancellation reason
    if (!reason || reason.trim() === "") {
      return res.status(400).json({ success: false, message: "Cancellation reason is required" });
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
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
};