const mongoose = require('mongoose');
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");

const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { date, product, status } = req.query;
    const searchParams = { date, product, status };

    let query = {};
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdOn = { $gte: startOfDay, $lte: endOfDay };
    }
    if (product) {
      query['orderedItems.productName'] = { $regex: product, $options: 'i' };
    }
    if (status) {
      query.$or = [
        { status },
        { requestStatus: status },
      ];
    }

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .populate({
        path: "orderedItems.product",
        select: "productName productImages salePrice stock",
      })
      .populate({
        path: "userId",
        select: "name",
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdOn: -1 });

    res.render("admin-orders", {
      orders,
      title: "Order Management",
      currentPage: page,
      totalPages,
      searchParams,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.render("admin-orders", {
      orders: [],
      title: "Order Management",
      currentPage: 1,
      totalPages: 1,
      searchParams: {},
      error: "Failed to load orders",
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(404).render("admin-order-details", {
        order: null,
        title: "Order Details",
        error: "Invalid order ID",
      });
    }

    const order = await Order.findById(orderId)
      .populate({
        path: "orderedItems.product",
        select: "productName productImages salePrice stock",
      })
      .populate({
        path: "userId",
        select: "name email",
      });

    if (!order) {
      return res.status(404).render("admin-order-details", {
        order: null,
        title: "Order Details",
        error: "Order not found",
      });
    }

    res.render("admin-order-details", {
      order,
      title: "Order Details",
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).render("admin-order-details", {
      order: null,
      title: "Order Details",
      error: "Internal server error",
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    
    console.log('Update order status request:', { orderId, status });

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Don't allow status change if order is cancelled or returned
    if (['cancelled', 'returned'].includes(order.status)) {
      return res.status(400).json({ success: false, message: "Cannot update cancelled or returned order" });
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'return_requested', 'returning', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    // Update order status and related fields
    order.status = status;
    order.updatedOn = new Date();
    
    if (status === "delivered") {
      order.deliveredOn = new Date();
      order.paymentStatus = 'completed';
    } else if (status === "confirmed") {
      order.confirmedOn = new Date();
    } else if (status === "shipped") {
      order.shippedOn = new Date();
    }

    await order.save();
    
    console.log('Order status updated successfully:', { orderId, newStatus: status });
    
    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    
    console.log('Cancel order request:', { orderId, reason });

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId).populate('orderedItems.product');
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (['cancelled', 'delivered', 'return_requested', 'returning', 'returned'].includes(order.status)) {
      return res.status(400).json({ success: false, message: "Order cannot be cancelled" });
    }

    // Validate cancellation reason
    const cancellationReason = reason || "Cancelled by admin";

    // Update order status and reason
    order.status = "cancelled";
    order.cancelReason = cancellationReason;
    order.cancelledOn = new Date();
    order.updatedOn = new Date();

    // Return product quantities to stock
    for (const item of order.orderedItems) {
      if (item.product) {
        await Product.findByIdAndUpdate(
          item.product._id,
          { $inc: { quantity: item.quantity } },
          { new: true, runValidators: true }
        );
        console.log(`Returned ${item.quantity} units to product ${item.product._id}`);
      } else {
        console.warn(`Product not found for productId: ${item.product}, Skipping stock update.`);
      }
    }

    // Credit refund to wallet if payment was made (online or wallet)
    if (order.paymentMethod === 'wallet' || order.paymentMethod === 'online') {
      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: 0,
          refundAmount: 0,
          totalDebited: 0,
          transactions: []
        });
      }

      const refundAmount = order.finalAmount;
      wallet.balance += refundAmount;
      wallet.refundAmount += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for cancelled order #${order.orderId} (Admin cancelled)`,
        transactionPurpose: 'order_refund',
        referenceId: order.orderId,
        date: new Date()
      });

      await wallet.save();
      console.log(`Refunded ₹${refundAmount} to user wallet for order ${order.orderId}`);
    }

    await order.save();
    
    console.log('Order cancelled successfully:', { orderId, reason: cancellationReason });
    
    res.json({ 
      success: true, 
      message: "Order cancelled successfully",
      refundAmount: order.paymentMethod !== 'cod' ? order.finalAmount : 0
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const handleReturn = async (req, res) => {
  try {
    const { orderId, action, category, message } = req.body;
    
    console.log('Handle return request:', { orderId, action, category, message });

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId).populate('orderedItems.product');
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== 'return_requested' || order.requestStatus !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: "Order is not eligible for return processing" 
      });
    }

    if (action === 'approve') {
      // Approve return request
      order.requestStatus = 'approved';
      order.status = 'returning';
      order.updatedOn = new Date();
      order.adminNote = 'Return request approved by admin';

      // Return product quantities to stock
      for (const item of order.orderedItems) {
        if (item.product) {
          await Product.findByIdAndUpdate(
            item.product._id,
            { $inc: { quantity: item.quantity } },
            { new: true, runValidators: true }
          );
          console.log(`Returned ${item.quantity} units to product ${item.product._id}`);
        } else {
          console.warn(`Product not found for productId: ${item.product}, Skipping stock update.`);
        }
      }

      // Credit refund to wallet
      let wallet = await Wallet.findOne({ userId: order.userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: order.userId,
          balance: 0,
          refundAmount: 0,
          totalDebited: 0,
          transactions: []
        });
      }

      const refundAmount = order.finalAmount;
      wallet.balance += refundAmount;
      wallet.refundAmount += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for returned order #${order.orderId}`,
        transactionPurpose: 'order_refund',
        referenceId: order.orderId,
        date: new Date()
      });

      await wallet.save();
      console.log(`Refunded ₹${refundAmount} to user wallet for returned order ${order.orderId}`);

      await order.save();
      
      res.json({ 
        success: true, 
        message: "Return request approved successfully",
        refundAmount: refundAmount
      });

    } else if (action === 'reject') {
      // Reject return request
      if (!category || !message) {
        return res.status(400).json({ 
          success: false, 
          message: "Rejection category and message are required" 
        });
      }

      order.requestStatus = 'rejected';
      order.rejectionCategory = category;
      order.rejectionReason = message;
      order.adminNote = `Return request rejected: ${category} - ${message}`;
      order.updatedOn = new Date();
      order.status = 'delivered';

      await order.save();
      
      res.json({ 
        success: true, 
        message: "Return request rejected successfully" 
      });

    } else {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid action. Must be 'approve' or 'reject'" 
      });
    }

  } catch (error) {
    console.error("Error handling return:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateReturnStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    
    console.log('Update return status request:', { orderId, status });

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status !== 'returning' || order.requestStatus !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: "Order is not in returning status" 
      });
    }

    // Validate status
    const validStatuses = ['returning', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid return status" });
    }

    // Update order status
    order.status = status;
    order.updatedOn = new Date();
    
    if (status === 'returned') {
      order.refundStatus = 'completed';
      order.refundDate = new Date();
      order.adminNote = 'Return completed by admin';
    }

    await order.save();
    
    console.log('Return status updated successfully:', { orderId, newStatus: status });
    
    res.json({ success: true, message: "Return status updated successfully" });
  } catch (error) {
    console.error("Error updating return status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
  handleReturn,
  updateReturnStatus,
};