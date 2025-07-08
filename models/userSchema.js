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
        ref: 'Cart' // Changed from array to single reference
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
    referalCode: {
        type: Boolean
    },
    redeemed: {
        type: Boolean
    },
    redeemedUsers: {
        type: Schema.Types.ObjectId,
        ref: 'User'
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

const User = mongoose.model('User', userSchema);
module.exports = User;