const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    googleId: {
        type: String,
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: {
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    },
    wallet: {
        type: Number,
        default: 0
    },
    wishlist: [{
        id: String,
        image: String,
        name: String,
        price: Number
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    createOn: {
        type: Date,
        default: Date.now,
    },
    referId: {
        type: String,
        unique: true,
    },
    referredBy: {
        type: String, // Referral code of the person who referred this user
    },
    referredUsers: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        name: String,
        email: String,
        joinedDate: {
            type: Date,
            default: Date.now
        },
        bonusEarned: {
            type: Number,
            default: 100
        }
    }],
    totalReferralEarnings: {
        type: Number,
        default: 0
    },
    joiningBonus: {
        type: Number,
        default: 0
    },
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category'
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
});

// Generate unique referral code before saving
userSchema.pre('save', function(next) {
    if (!this.referId) {
        this.referId = this.generateReferralCode();
    }
    next();
});

// Method to generate unique referral code
userSchema.methods.generateReferralCode = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'SAW'; // Brand prefix
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const User = mongoose.model('User', userSchema);
module.exports = User;