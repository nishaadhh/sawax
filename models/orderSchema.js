const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  orderedItems: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productImages: [{
      type: String,
    }],
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    regularPrice: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returning', 'returned'],
      default: 'pending',
    },
    cancelReason: {
      type: String,
    },
    returnReason: {
      type: String,
    },
  }],
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  deliveryCharge: {
    type: Number,
    default: 50,
    min: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  address: {
    name: { type: String, required: true },
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    country: { type: String, default: 'India' },
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'wallet'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  couponCode: {
    type: String,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  updatedOn: {
    type: Date,
    default: Date.now,
  },
  confirmedOn: {
    type: Date,
  },
  shippedOn: {
    type: Date,
  },
  deliveredOn: {
    type: Date,
  },
  cancelledOn: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returning', 'returned', 'payment_pending'],
    default: 'pending',
  },
  trackingNumber: {
    type: String,
  },
  cancelReason: {
    type: String,
  },
  returnReason: {
    type: String,
  },
  returnDescription: {
    type: String,
  },
  returnImages: [{
    type: String,
  }],
  requestStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
  },
  rejectionReason: {
    type: String,
  },
  rejectionCategory: {
    type: String,
  },
  adminNote: {
    type: String,
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'completed'],
    default: 'pending',
  },
  refundDate: {
    type: Date,
  },
  estimatedDelivery: {
    type: Date,
  },
  orderNotes: {
    type: String,
  },
  // Razorpay 
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  // Order grouping 
  orderGroupId: {
    type: String,
    index: true,
  },
  isGrouped: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true
});


orderSchema.index({ userId: 1, createdOn: -1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentMethod: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ razorpayOrderId: 1 });
orderSchema.index({ razorpayPaymentId: 1 });
orderSchema.index({ orderGroupId: 1 });
orderSchema.index({ userId: 1, orderGroupId: 1 });

orderSchema.pre('save', function(next) {
  this.updatedOn = new Date();
  
  
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case 'confirmed':
        if (!this.confirmedOn) this.confirmedOn = now;
        break;
      case 'shipped':
        if (!this.shippedOn) this.shippedOn = now;
        break;
      case 'delivered':
        if (!this.deliveredOn) this.deliveredOn = now;
        if (this.paymentMethod === 'cod') {
          this.paymentStatus = 'completed';
        }
        break;
      case 'cancelled':
        if (!this.cancelledOn) this.cancelledOn = now;
        break;
      case 'returned':
        if (!this.refundDate) this.refundDate = now;
        this.refundStatus = 'completed';
        break;
    }
  }
  
  next();
});

// calculate days order
orderSchema.virtual('daysSinceOrder').get(function() {
  return Math.floor((new Date() - this.createdOn) / (1000 * 60 * 60 * 24));
});

//  return  eligible ano nn nokal
orderSchema.virtual('isReturnEligible').get(function() {
  if (this.status !== 'delivered' || this.requestStatus) return false;
  if (!this.deliveredOn) return false;
  
  const daysSinceDelivery = Math.floor((new Date() - this.deliveredOn) / (1000 * 60 * 60 * 24));
  return daysSinceDelivery <= 7;
});

// payment retry 
orderSchema.virtual('needsPaymentRetry').get(function() {
  return this.paymentMethod === 'online' && 
         (this.paymentStatus === 'failed' || this.paymentStatus === 'pending') &&
         this.status === 'payment_pending';
});


orderSchema.virtual('formattedAmount').get(function() {
  return `₹${this.finalAmount.toFixed(2)}`;
});

module.exports = mongoose.model('Order', orderSchema);