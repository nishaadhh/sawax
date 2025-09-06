const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: false,
        unique: true,
        sparse: true, // Allows null values but enforces uniqueness when present
        minlength: 3,
        maxlength: 30,
        match: /^[a-zA-Z0-9_]+$/ // Only alphanumeric and underscore
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
    required: function() {
        return !this.googleId; // Only required if not a Google user
    }
}
,
    profileImage: {
        type: String,
        default: '/images/default-avatar.png'
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
        type: String,
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
    let result = 'SAW';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const User = mongoose.model('User', userSchema);
module.exports = User;