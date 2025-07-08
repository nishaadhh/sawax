const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
  },
  totalDebited: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
  },
  transactions: [
    {
      description: {
        type: String,
        trim: true,
        default: 'Transaction',
      },
      amount: {
        type: Number,
        required: true,
      },
      type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true,
      },
      transactionPurpose: {
        type: String,
        trim: true,
      },
      date: {
        type: Date,
        default: Date.now,
      },
      referenceId: {
        type: String,
        trim: true,
      },
      status: {
        type: String,
        default: 'COMPLETED',
      },
    },
  ],
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;``


// =====