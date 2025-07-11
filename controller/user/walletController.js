const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const Address = require("../../models/addressSchema");
const Wallet = require("../../models/walletSchema");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Helper function to generate short receipt ID (max 40 chars)
const generateReceiptId = (prefix = 'wallet') => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits
  const random = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
  return `${prefix}_${timestamp}_${random}`; // Total: ~20 chars
};

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        let wallet = await Wallet.findOne({ userId: userId });

        // Create wallet if it doesn't exist
        if (!wallet) {
            wallet = new Wallet({
                userId: userId,
                balance: 0,
                refundAmount: 0,
                totalDebited: 0,
                transactions: []
            });
            await wallet.save();
        }

        // Pagination for transactions
        const page = parseInt(req.query.page) || 1;
        const limit = 10; 
        const skip = (page - 1) * limit;

        let transactions = [];
        let totalTransactions = 0;

        if (wallet && wallet.transactions) {
            // Sort transactions by date (newest first)
            const sortedTransactions = wallet.transactions.sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });
            
            totalTransactions = sortedTransactions.length;
            transactions = sortedTransactions.slice(skip, skip + limit);
        }

        const totalPages = Math.ceil(totalTransactions / limit);

        res.render("wallet", {
            user: userData,
            wallet: wallet,
            transactions: transactions,
            currentPage: page,
            totalPages: totalPages,
            hasTransactions: totalTransactions > 0
        });
    } catch (error) {
        console.error('Error loading wallet:', error);
        res.status(500).render('error', { 
            message: 'Failed to load wallet',
            user: null 
        });
    }
};

const createRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.session.user;

        console.log('Creating Razorpay order for wallet:', { amount, userId });

        if (!amount || amount < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'Amount must be at least ₹1' 
            });
        }

        if (amount > 50000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Maximum amount allowed is ₹50,000' 
            });
        }

        // Generate short receipt ID
        const receiptId = generateReceiptId('wallet');
        
        const options = {
            amount: Math.round(amount * 100), // Razorpay expects amount in paise
            currency: "INR",
            receipt: receiptId,
            notes: {
                user_id: userId.toString().slice(-12), // Shortened user ID
                purpose: 'wallet_recharge'
            }
        };

        console.log('Creating Razorpay order with options:', {
            // amount: options.amount,
            receipt: options.receipt,
            receipt_length: options.receipt.length
        });

        const order = await razorpay.orders.create(options);
        
        console.log('Razorpay order created:', order.id);

        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create payment order',
            error: error.message
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.session.user;

        console.log('Verifying wallet payment:', { razorpay_order_id, razorpay_payment_id });

        // Verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            console.error('Payment signature verification failed');
            return res.status(400).json({ 
                success: false, 
                message: 'Payment verification failed - Invalid signature' 
            });
        }

        // Get payment details from Razorpay
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        console.log('Payment details:', { status: payment.status, amount: payment.amount });

        if (payment.status !== 'captured') {
            return res.status(400).json({ 
                success: false, 
                message: 'Payment not captured' 
            });
        }

        const amount = payment.amount / 100; // Convert paise to rupees

        // Update wallet
        let wallet = await Wallet.findOne({ userId: userId });
        if (!wallet) {
            wallet = new Wallet({
                userId: userId,
                balance: 0,
                refundAmount: 0,
                totalDebited: 0,
                transactions: []
            });
        }

        // Add to wallet balance
        wallet.balance += Number(amount);
        wallet.transactions.push({
            amount: Number(amount),
            type: 'credit',
            description: `Added money to wallet via online payment`,
            transactionPurpose: 'wallet_recharge',
            referenceId: razorpay_payment_id,
            status: 'COMPLETED',
            date: new Date()
        });

        await wallet.save();
        
        console.log('Wallet updated successfully:', { newBalance: wallet.balance });

        res.json({ 
            success: true, 
            message: 'Payment verified and wallet updated successfully',
            newBalance: wallet.balance
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Payment verification failed',
            error: error.message
        });
    }
};

const withdrawMoney = async (req, res) => {
    try {
        const userId = req.session.user;
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please enter a valid amount' 
            });
        }

        if (amount < 10) {
            return res.status(400).json({ 
                success: false, 
                message: 'Minimum withdrawal amount is ₹10' 
            });
        }

        const wallet = await Wallet.findOne({ userId: userId });
        
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Insufficient wallet balance' 
            });
        }

        // Deduct from wallet
        wallet.balance -= Number(amount);
        wallet.totalDebited += Number(amount);
        wallet.transactions.push({
            amount: Number(amount),
            type: 'debit',
            description: `Money withdrawn from wallet`,
            transactionPurpose: 'withdrawal',
            status: 'COMPLETED',
            date: new Date(),
            referenceId: `WD_${Date.now()}`
        });

        await wallet.save();
        
        res.json({ 
            success: true, 
            message: 'Money withdrawn successfully',
            newBalance: wallet.balance
        });
    } catch (error) {
        console.error('Error withdrawing money:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Withdrawal failed. Please try again.',
            error: error.message
        });
    }
};

module.exports = {
    loadWallet,
    createRazorpayOrder,
    verifyPayment,
    withdrawMoney
};