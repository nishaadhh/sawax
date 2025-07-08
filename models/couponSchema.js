const mongoose = require('mongoose');
const couponSchema = new mongoose.Schema({
    title: String,
    description: String,
    type: String,
    discountValue: Number,
    discountType: String,
    code: String,
    minOrder: Number,
    maxDiscount: Number,
    expireOn: Date,
    usageLimit: Number,
    usedCount: { type: Number, default: 0 },
    userId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPremium: Boolean,
    isList: { type: Boolean, default: true },
    createdOn: { type: Date, default: Date.now }
});

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;