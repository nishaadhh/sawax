const mongoose = require('mongoose');
const { Schema } = mongoose;

const referralSchema = new Schema({
    referrerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    refereeId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referralCode: {
        type: String,
        required: true,
        index: true
    },
    rewardAmount: {
        type: Number,
        default: 50
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'expired'],
        default: 'completed'
    },
    rewardCredited: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    creditedAt: {
        type: Date
    }
}, { timestamps: true });

referralSchema.index({ referrerId: 1, createdAt: -1 });
referralSchema.index({ refereeId: 1 });
referralSchema.index({ referralCode: 1 });

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;