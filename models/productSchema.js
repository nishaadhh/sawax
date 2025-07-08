const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  description: { type: String, required: true },
  brand: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  regularPrice: { type: Number, required: true }, // Original price before any offers
  salePrice: { type: Number, required: true }, // Final price after applying offers
  productOffer: { type: Number, default: 0, min: 0, max: 99 }, // Product-specific offer percentage
  quantity: { type: Number, required: true },
  color: { type: String, required: true },
  productImage: { type: [String], required: true },
  isBlocked: { type: Boolean, default: false },
  status: { type: String, enum: ['available', 'out of stock', 'Discontinued'], required: true, default: 'available' },
}, { timestamps: true });

// Method to calculate final price based on product and category offers
productSchema.methods.calculateSalePrice = function(categoryOffer = 0) {
  const maxOffer = Math.max(this.productOffer || 0, categoryOffer || 0);
  this.salePrice = Math.round(this.regularPrice * (1 - maxOffer / 100));
  return this.salePrice;
};

const Product = mongoose.model('Product', productSchema);
module.exports = Product;