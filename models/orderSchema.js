const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String },
  orderDate: { type: Date, default: Date.now },
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  orderedItems: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, required: true },
    status: { type: String, default: 'pending' }
  }],
  shippingAddress: { type: String, required: true },
  updatedOn: { type: Date },
  deliveredOn: { type: Date }
});

module.exports = mongoose.model('Order', orderSchema);