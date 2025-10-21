const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Wallet = require("../../models/walletSchema");
const Coupon = require("../../models/couponSchema");
const { markCouponAsUsed } = require("./couponController");
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const crypto = require('crypto');

const DELIVERY_CHARGE = 50;

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

//function to generate unique order ID
const generateOrderId = () => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD${timestamp.slice(-6)}${random}`;
};

// Helper function to generate short receipt ID (max 40 chars)
const generateReceiptId = (prefix = 'rcpt') => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits
  const random = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 chars
  return `${prefix}_${timestamp}_${random}`; // Total: ~20 chars
};

// Helper function to distribute discount proportionally across products
const distributeDiscount = (cartItems, totalDiscount) => {
  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return cartItems.map((item) => {
    const itemTotal = item.price * item.quantity;
    const discountShare = (itemTotal / totalAmount) * totalDiscount;
    return {
      ...item,
      discountedPrice: item.price - discountShare / item.quantity,
      itemDiscount: discountShare,
    };
  });
};

//calculate coupon discount
const calculateCouponDiscount = (coupon, subtotal, cartItems, shippingCharge) => {
  const { type, discountValue, minOrder, maxDiscount } = coupon;
  let discount = 0;
  let newShippingCharge = shippingCharge;

  // Validate minimum order requirement
  if (subtotal < minOrder) {
    throw new Error(`Minimum order amount of ₹${minOrder} required for this coupon`);
  }

  // Calculate discount based on coupon type
  if (type === 'percentage') {
    discount = Math.min((subtotal * discountValue) / 100, maxDiscount || Number.MAX_SAFE_INTEGER);
  } else if (type === 'fixed') {
    discount = Math.min(discountValue, maxDiscount || Number.MAX_SAFE_INTEGER);
  } else if (type === 'shipping') {
    newShippingCharge = 0;
    discount = shippingCharge; // The discount is the shipping charge itself
  } else if (type === 'bogo') {
    if (cartItems.length > 1) {
      const prices = cartItems.map(item => item.price * item.quantity);
      discount = Math.min(...prices); 
    } else {
      throw new Error('BOGO coupon requires at least two items in the cart');
    }
  }

  return { discount, newShippingCharge };
};

// Helper function to create orders from cart items
const createOrdersFromCartItems = async (orderData) => {
  const {
    userId, cartItems, selectedAddress, subtotal, discount, 
    shippingCharge, finalAmount, couponCode, couponApplied,
    appliedCoupon, paymentMethod, paymentStatus, razorpayOrderId = null,
    razorpayPaymentId = null
  } = orderData;

  // Distribute discount across items
  const discountedItems = distributeDiscount(cartItems, discount);

  // Create separate orders for each product
  const createdOrders = [];
  
  for (const item of discountedItems) {
    // Check product availability
    const product = await Product.findById(item.product);
    if (!product || product.quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${item.productName}`);
    }

    // Calculate item totals
    const itemTotal = item.price * item.quantity;
    const itemDiscountShare = item.itemDiscount || 0;
    const itemDeliveryCharge = DELIVERY_CHARGE;
    const itemFinalAmount = itemTotal - itemDiscountShare + itemDeliveryCharge;

    const order = new Order({
      userId: userId,
      orderId: generateOrderId(),
      orderedItems: [{
        product: item.product,
        productName: item.productName,
        productImages: item.productImages,
        quantity: item.quantity,
        price: item.discountedPrice,
        regularPrice: product.regularPrice || item.price,
      }],
      totalPrice: itemTotal,
      discount: itemDiscountShare,
      deliveryCharge: itemDeliveryCharge,
      finalAmount: itemFinalAmount,
      address: {
        name: selectedAddress.name,
        streetAddress: selectedAddress.streetAddress,
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        email: selectedAddress.email,
      },
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      couponApplied: couponApplied,
      couponCode: couponCode,
      createdOn: new Date(),
      status: 'pending',
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId,
    });

    // Update product quantity
    await Product.findByIdAndUpdate(item.product, {
      $inc: { quantity: -item.quantity },
    });

    await order.save();
    createdOrders.push(order);
  }

  return createdOrders;
};

// Create Razorpay order for checkout
const createCheckoutOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, couponCode } = req.body;

    console.log('CreateCheckoutOrder request:', { userId, addressId, couponCode });

    // Fetch user and cart
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Fetch address
    const address = await Address.findOne({ userId, 'address._id': addressId });
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address not found',
      });
    }

    const selectedAddress = address.address.find((addr) => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: 'Selected address not found',
      });
    }

    // Calculate totals
    const cartItems = cart.items.map(item => ({
      product: item.productId._id,
      productName: item.productId.productName,
      productImages: item.productId.productImage,
      quantity: item.quantity,
      price: item.productId.salePrice,
      productId: item.productId
    }));

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let shippingCharge = DELIVERY_CHARGE;
    let discount = 0;
    let couponApplied = false;
    let appliedCoupon = null;

    // Apply coupon discount if provided
    if (couponCode) {
      // Check if coupon is in session (already validated)
      if (req.session.appliedCoupon && req.session.appliedCoupon.code === couponCode) {
        appliedCoupon = req.session.appliedCoupon;
        const discountResult = calculateCouponDiscount(appliedCoupon, subtotal, cartItems, shippingCharge);
        discount = discountResult.discount;
        shippingCharge = discountResult.newShippingCharge;
        couponApplied = true;
        console.log('Applied coupon from session:', { couponCode, discount, shippingCharge });
      } else {
        // Validate coupon from database
        const coupon = await Coupon.findOne({ 
          code: { $regex: new RegExp("^" + couponCode + "$", "i") }, 
          isList: true, 
          expireOn: { $gt: new Date() } 
        });

        if (!coupon) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or expired coupon',
          });
        }

        // Check if user has already used the coupon
        if (coupon.userId.includes(userId)) {
          return res.status(400).json({
            success: false,
            message: 'Coupon already used or not eligible ',
          });
        }

        // Check usage limit
        if (coupon.usedCount >= coupon.usageLimit) {
          return res.status(400).json({
            success: false,
            message: 'Coupon usage limit reached',
          });
        }

        // Checking if coupon is premium and user is eligible
        if (coupon.isPremium && !coupon.userId.includes(userId)) {
          return res.status(400).json({
            success: false,
            message: 'Premium coupon not available for this user',
          });
        }

        appliedCoupon = {
          _id: coupon._id,
          code: coupon.code,
          discountValue: coupon.discountValue,
          type: coupon.type,
          minOrder: coupon.minOrder,
          maxDiscount: coupon.maxDiscount
        };

        const discountResult = calculateCouponDiscount(appliedCoupon, subtotal, cartItems, shippingCharge);
        discount = discountResult.discount;
        shippingCharge = discountResult.newShippingCharge;
        couponApplied = true;
        console.log('Applied coupon from database:', { couponCode, discount, shippingCharge });
      }
    }

    const finalAmount = subtotal - discount + shippingCharge;

    console.log('Order calculation:', {
      subtotal,
      discount,
      shippingCharge,
      finalAmount,
      couponApplied
    });

    // Create Razorpay order with short receipt
    const receiptId = generateReceiptId('order');
    const options = {
      amount: Math.round(finalAmount * 100), // Razorpay expects amount in paise
      currency: "INR",
      receipt: receiptId,
      notes: {
        user_id: userId.toString().slice(-12), // Shortened user ID
        address_id: addressId.toString().slice(-12), // Shortened address ID
        coupon_code: couponCode ? couponCode.substring(0, 10) : '', // Limit coupon code
        purpose: 'order_payment'
      }
    };

    console.log('Creating Razorpay order with options:', {
      receipt: options.receipt,
      receipt_length: options.receipt.length
    });

    const razorpayOrder = await razorpay.orders.create(options);

    // Store order details in session for verification
    req.session.pendingOrder = {
      cartItems,
      selectedAddress,
      subtotal,
      discount,
      shippingCharge,
      finalAmount,
      couponCode,
      couponApplied,
      appliedCoupon,
      razorpayOrderId: razorpayOrder.id
    };

    console.log('Razorpay order created successfully:', razorpayOrder.id);

    res.json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error creating checkout order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order',
      error: error.message
    });
  }
};

// Verify Razorpay payment and create orders
const verifyCheckoutPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.session.user;

    console.log('VerifyCheckoutPayment request:', { razorpay_order_id, razorpay_payment_id });

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

    // Get pending order details from session
    const pendingOrder = req.session.pendingOrder;
    if (!pendingOrder || pendingOrder.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order details not found or mismatch'
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

    // Mark coupon as used if it was applied
    if (pendingOrder.couponApplied && pendingOrder.appliedCoupon) {
      await markCouponAsUsed(pendingOrder.appliedCoupon._id, userId);
      console.log('Coupon marked as used:', pendingOrder.appliedCoupon.code);
    }

    // Create orders with payment completed
    const orderData = {
      userId: userId,
      cartItems: pendingOrder.cartItems,
      selectedAddress: pendingOrder.selectedAddress,
      subtotal: pendingOrder.subtotal,
      discount: pendingOrder.discount,
      shippingCharge: pendingOrder.shippingCharge,
      finalAmount: pendingOrder.finalAmount,
      couponCode: pendingOrder.couponCode,
      couponApplied: pendingOrder.couponApplied,
      appliedCoupon: pendingOrder.appliedCoupon,
      paymentMethod: 'online',
      paymentStatus: 'completed',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id
    };

    const createdOrders = await createOrdersFromCartItems(orderData);

    // Clear cart and session
    await Cart.findOneAndDelete({ userId });
    delete req.session.pendingOrder;
    delete req.session.appliedCoupon;

    console.log('Orders created successfully:', createdOrders.length);

    res.json({
      success: true,
      message: 'Payment verified and orders created successfully',
      orders: createdOrders.map(order => ({
        orderId: order.orderId,
        finalAmount: order.finalAmount
      })),
      totalOrders: createdOrders.length,
      redirectUrl: '/orders'
    });

  } catch (error) {
    console.error('Error verifying checkout payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed',
      error: error.message
    });
  }
};

// NEW: Handle payment failure and create orders with pending status
const handlePaymentFailure = async (req, res) => {
  try {
    const { razorpay_order_id, error_description } = req.body;
    const userId = req.session.user;

    console.log('HandlePaymentFailure request:', { razorpay_order_id, error_description });

    // Get pending order details from session
    const pendingOrder = req.session.pendingOrder;
    if (!pendingOrder || pendingOrder.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order details not found or mismatch'
      });
    }

    // Create orders with payment pending status
    const orderData = {
      userId: userId,
      cartItems: pendingOrder.cartItems,
      selectedAddress: pendingOrder.selectedAddress,
      subtotal: pendingOrder.subtotal,
      discount: pendingOrder.discount,
      shippingCharge: pendingOrder.shippingCharge,
      finalAmount: pendingOrder.finalAmount,
      couponCode: pendingOrder.couponCode,
      couponApplied: pendingOrder.couponApplied,
      appliedCoupon: pendingOrder.appliedCoupon,
      paymentMethod: 'online',
      paymentStatus: 'pending', // Payment failed, so status is pending
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: null
    };

    const createdOrders = await createOrdersFromCartItems(orderData);

    // Clear cart but keep session data for potential retry
    await Cart.findOneAndDelete({ userId });
    
    // Store failed order details for retry
    req.session.failedOrders = createdOrders.map(order => ({
      orderId: order._id.toString(),
      razorpayOrderId: razorpay_order_id,
      finalAmount: order.finalAmount
    }));

    // Don't clear session data yet - needed for retry
    delete req.session.pendingOrder;

    console.log('Orders created with pending payment:', createdOrders.length);

    res.json({
      success: true,
      message: 'Orders created with pending payment. You can complete payment from orders page.',
      orders: createdOrders.map(order => ({
        orderId: order.orderId,
        finalAmount: order.finalAmount,
        paymentStatus: 'pending'
      })),
      totalOrders: createdOrders.length,
      redirectUrl: '/orders'
    });

  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to handle payment failure',
      error: error.message
    });
  }
};

// NEW: Retry payment for failed orders
const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user;

    console.log('RetryPayment request:', { orderId });

    // Find the order
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.paymentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed for this order'
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create new Razorpay order for retry
    const receiptId = generateReceiptId('retry');
    const options = {
      amount: Math.round(order.finalAmount * 100), // Razorpay expects amount in paise
      currency: "INR",
      receipt: receiptId,
      notes: {
        user_id: userId.toString().slice(-12),
        order_id: order._id.toString().slice(-12),
        original_order: order.orderId,
        purpose: 'payment_retry'
      }
    };

    console.log('Creating Razorpay retry order:', options.receipt);

    const razorpayOrder = await razorpay.orders.create(options);

    // Store retry order details in session
    req.session.retryOrder = {
      orderId: order._id.toString(),
      originalOrderId: order.orderId,
      razorpayOrderId: razorpayOrder.id,
      finalAmount: order.finalAmount
    };

    res.json({
      success: true,
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error creating retry payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create retry payment',
      error: error.message
    });
  }
};

// NEW: Verify retry payment
const verifyRetryPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.session.user;

    console.log('VerifyRetryPayment request:', { razorpay_order_id, razorpay_payment_id });

    // Verify signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      console.error('Retry payment signature verification failed');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed - Invalid signature'
      });
    }

    // Get retry order details from session
    const retryOrder = req.session.retryOrder;
    if (!retryOrder || retryOrder.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Retry order details not found or mismatch'
      });
    }

    // Get payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    console.log('Retry payment details:', { status: payment.status, amount: payment.amount });

    if (payment.status !== 'captured') {
      return res.status(400).json({
        success: false,
        message: 'Payment not captured'
      });
    }

    // Update order with payment details
    const order = await Order.findByIdAndUpdate(
      retryOrder.orderId,
      {
        paymentStatus: 'completed',
        razorpayPaymentId: razorpay_payment_id,
        status: 'confirmed',
        confirmedOn: new Date(),
        updatedOn: new Date()
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Clear retry session data
    delete req.session.retryOrder;
    delete req.session.failedOrders;

    console.log('Retry payment successful for order:', order.orderId);

    res.json({
      success: true,
      message: 'Payment completed successfully',
      order: {
        orderId: order.orderId,
        finalAmount: order.finalAmount,
        paymentStatus: order.paymentStatus,
        status: order.status
      }
    });

  } catch (error) {
    console.error('Error verifying retry payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Retry payment verification failed',
      error: error.message
    });
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod, couponCode } = req.body;

    console.log('PlaceOrder request:', { userId, addressId, paymentMethod, couponCode });

    // Validate payment method
    if (!['cod', 'online', 'wallet'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }

    // For online payment, redirect to Razorpay flow
    if (paymentMethod === 'online') {
      return res.json({
        success: true,
        requiresPayment: true,
        message: 'Please use the online payment option above'
      });
    }

    // Fetch user and cart
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Fetch address
    const address = await Address.findOne({ userId, 'address._id': addressId });
    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address not found',
      });
    }

    const selectedAddress = address.address.find((addr) => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: 'Selected address not found',
      });
    }

    // Calculate totals
    const cartItems = cart.items.map(item => ({
      product: item.productId._id,
      productName: item.productId.productName,
      productImages: item.productId.productImage,
      quantity: item.quantity,
      price: item.productId.salePrice,
      productId: item.productId
    }));

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let shippingCharge = DELIVERY_CHARGE;
    let discount = 0;
    let couponApplied = false;
    let appliedCoupon = null;

    // Apply coupon discount if provided
    if (couponCode) {
      // Check if coupon is in session (already validated)
      if (req.session.appliedCoupon && req.session.appliedCoupon.code === couponCode) {
        appliedCoupon = req.session.appliedCoupon;
        const discountResult = calculateCouponDiscount(appliedCoupon, subtotal, cartItems, shippingCharge);
        discount = discountResult.discount;
        shippingCharge = discountResult.newShippingCharge;
        couponApplied = true;
        console.log('Applied coupon from session:', { couponCode, discount, shippingCharge });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired coupon. Please apply the coupon again.',
        });
      }
    }

    const finalAmount = subtotal - discount + shippingCharge;

    console.log('Order calculation:', {
      subtotal,
      discount,
      shippingCharge,
      finalAmount,
      couponApplied
    });

    // Handle wallet payment
    if (paymentMethod === 'wallet') {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalAmount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance',
        });
      }

      // Deduct from wallet
      wallet.balance -= finalAmount;
      wallet.totalDebited += finalAmount;
      wallet.transactions.push({
        amount: finalAmount,
        type: 'debit',
        description: 'Order payment',
        transactionPurpose: 'order_payment',
        referenceId: `PAYMENT_${Date.now()}`,
      });
      await wallet.save();
    }

    // Mark coupon as used if it was applied
    if (couponApplied && appliedCoupon) {
      await markCouponAsUsed(appliedCoupon._id, userId);
      console.log('Coupon marked as used:', appliedCoupon.code);
    }

    // Create orders for COD and Wallet payments
    const orderData = {
      userId: userId,
      cartItems: cartItems,
      selectedAddress: selectedAddress,
      subtotal: subtotal,
      discount: discount,
      shippingCharge: shippingCharge,
      finalAmount: finalAmount,
      couponCode: couponCode,
      couponApplied: couponApplied,
      appliedCoupon: appliedCoupon,
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === 'wallet' ? 'completed' : 'pending'
    };

    const createdOrders = await createOrdersFromCartItems(orderData);

    // Clear cart and session
    await Cart.findOneAndDelete({ userId });
    delete req.session.appliedCoupon;

    res.json({
      success: true,
      message: 'Orders placed successfully',
      orders: createdOrders.map(order => ({
        orderId: order.orderId,
        finalAmount: order.finalAmount
      })),
      totalOrders: createdOrders.length
    });

  } catch (error) {
    console.error('Error in placeOrder:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to place order',
      error: error.message
    });
  }
};

const isSameGroup = (o1, o2) => {
  const timeDiff = Math.abs(new Date(o1.createdOn) - new Date(o2.createdOn)) / 1000 < 60;
  const sameAddress =
    o1.address.name === o2.address.name &&
    o1.address.streetAddress === o2.address.streetAddress &&
    o1.address.city === o2.address.city &&
    o1.address.state === o2.address.state &&
    o1.address.pincode === o2.address.pincode &&
    o1.address.phone === o2.address.phone &&
    o1.address.email === o2.address.email;
  const samePayment = o1.paymentMethod === o2.paymentMethod;
  const sameCoupon = (o1.couponCode || '') === (o2.couponCode || '');
  return timeDiff && sameAddress && samePayment && sameCoupon;
};

const getOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect('/login');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ userId });
    const orders = await Order.find({ userId })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage salePrice',
      });

    // Group orders
    let groups = [];
    let currentGroup = [];
    orders.forEach((order) => {
      if (currentGroup.length === 0 || isSameGroup(currentGroup[currentGroup.length - 1], order)) {
        currentGroup.push(order);
      } else {
        groups.push(currentGroup);
        currentGroup = [order];
      }
    });
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    const user = await User.findById(userId);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders", {
      groups: groups || [],
      user: user,
      error: null,
      currentPage: page,
      totalPages: totalPages,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (error) {
    console.error("Error in getOrders:", error);
    res.render("orders", {
      groups: [],
      user: null,
      error: "Failed to load orders. Please try again later.",
      currentPage: 1,
      totalPages: 1,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  }
};

const loadOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.orderId || req.query.orderId;

    const order = await Order.findOne({ 
      $or: [
        { orderId: orderId, userId },
        { _id: orderId, userId }
      ]
    }).populate({
      path: 'orderedItems.product',
      select: 'productName productImage salePrice regularPrice',
    });

    if (!order) {
      return res.status(404).render('error', { 
        message: 'Order not found',
        user: await User.findById(userId)
      });
    }

    const user = await User.findById(userId);

    res.render("order-details", {
      order,
      user,
    });
  } catch (error) {
    console.error("Error in loadOrderDetails:", error);
    res.status(500).render('error', { 
      message: "Internal server error",
      user: null
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const userId = req.session.user;

    if (!orderId || !reason || reason.trim() === "") {
      return res.status(400).json({ 
        success: false, 
        message: "Order ID and cancellation reason are required" 
      });
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not logged in" 
      });
    }

    const order = await Order.findOne({ _id: orderId, userId }).populate('orderedItems.product');
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      return res.status(400).json({ 
        success: false, 
        message: "Order cannot be cancelled" 
      });
    }

    // Update order status
    order.status = "cancelled";
    order.cancelReason = reason;
    order.updatedOn = new Date();

    // Return product quantities to stock
    for (const item of order.orderedItems) {
      if (item.product) {
        await Product.findByIdAndUpdate(
          item.product._id,
          { $inc: { quantity: item.quantity } },
          { new: true, runValidators: true }
        );
      }
    }

    // Credit refund to wallet if payment was made
    if (order.paymentMethod === 'wallet' || (order.paymentMethod === 'online' && order.paymentStatus === 'completed')) {
      let wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        wallet = new Wallet({
          userId: userId,
          balance: 0,
          refundAmount: 0,
          totalDebited: 0,
          transactions: []
        });
      }

      const refundAmount = order.finalAmount;
      wallet.balance += refundAmount;
      wallet.refundAmount += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for cancelled order #${order.orderId}`,
        transactionPurpose: 'order_refund',
        referenceId: order.orderId,
      });

      await wallet.save();
    }

    await order.save();

    res.json({ 
      success: true, 
      message: "Order cancelled successfully",
      refundAmount: (order.paymentMethod !== 'cod' && order.paymentStatus === 'completed') ? order.finalAmount : 0
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};

const requestReturn = async (req, res) => {
  try {
    const { orderId, returnReason, returnDescription } = req.body;
    const userId = req.session.user;

    if (!orderId || !returnReason) {
      return res.status(400).json({ 
        success: false, 
        message: "Order ID and return reason are required" 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid order ID" 
      });
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }

    if (order.status !== 'delivered' || order.requestStatus) {
      return res.status(400).json({
        success: false,
        message: "Order is not eligible for return",
      });
    }

    // Check if return period is valid (7 days after delivery)
    if (order.deliveredOn) {
      const deliveryDate = new Date(order.deliveredOn);
      const currentDate = new Date();
      const daysSinceDelivery = Math.floor((currentDate - deliveryDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceDelivery > 7) {
        return res.status(400).json({
          success: false,
          message: "Return period has expired (7 days after delivery)",
        });
      }
    }

    order.status = 'return_requested';
    order.returnReason = returnReason;
    order.returnDescription = returnDescription || '';
    order.requestStatus = 'pending';
    order.updatedOn = new Date();

    await order.save();

    res.json({
      success: true,
      message: "Return request submitted successfully",
    });
  } catch (error) {
    console.error("Error in requestReturn:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const renderSuccessPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.params;

    if (!userId) {
      return res.redirect('/login?message=' + encodeURIComponent('Please log in to view order details'));
    }

    const order = await Order.findOne({ orderId, userId })
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage salePrice',
      });

    if (!order) {
      return res.status(404).render('error', { 
        message: 'Order not found',
        user: await User.findById(userId)
      });
    }

    const user = await User.findById(userId);

    res.render('order-success', {
      order,
      user,
    });
  } catch (error) {
    console.error("Error in renderSuccessPage:", error);
    res.status(500).render('error', { 
      message: 'Failed to load order success page',
      user: null
    });
  }
};

module.exports = {
  placeOrder,
  createCheckoutOrder,
  verifyCheckoutPayment,
  handlePaymentFailure,
  retryPayment,
  verifyRetryPayment,
  getOrders,
  loadOrderDetails,
  cancelOrder,
  requestReturn,
  renderSuccessPage,
};