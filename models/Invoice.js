// models/Invoice.js
const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: String,
  orderId: mongoose.Schema.Types.ObjectId,
  customerName: String,
  address: String,
  items: [
    {
      name: String,
      price: Number,
      quantity: Number,
    },
  ],
  totalAmount: Number,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Invoice", invoiceSchema);
