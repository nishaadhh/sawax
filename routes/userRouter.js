const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const profileController = require("../controller/user/profileController");
const cartController = require("../controller/user/cartController");
const passport = require("../config/passport");
const { userAuth } = require("../middlewares/auth");
const Order = require('../models/orderSchema');
const checkoutController = require('../controller/user/checkoutController');
const orderController = require('../controller/user/orderController');
const walletController = require("../controller/user/walletController");
const path = require("path");
const Coupon = require("../models/couponSchema");
const couponController = require("../controller/user/couponController");

// Home & Pages
router.get("/", userController.loadHomePage);
router.get("/signup", userController.loadSignUpPage);
router.post("/signup", userController.signUp);
router.post("/verify-otp", userController.verifyOtp);
router.get("/resendOtp", userController.resendOtp);
router.get("/product/:id", userController.loadProductDetails);
router.get("/shop", userController.loadShoppingPage);
router.get("/filter", userController.filterProduct);

// Google Authentication
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  async (req, res) => {
    try {
      req.session.user = req.user._id;
      res.redirect("/");
    } catch (error) {
      console.error("Google login error:", error);
      res.redirect("/signup?error=google-auth-failed");
    }
  }
);

// Login & Logout
router.get("/login", userController.loadLoginPage);
router.post("/login", userController.login);
router.get("/logout", userController.logout);

// Forgot Password Routes
router.get('/forgot-password', userController.renderForgotPassword);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);
router.get('/otp-verification', userController.forgetpasswordOtp);

// Static Pages
router.get("/about", userController.about);

// Profile Routes
router.get("/profile", userAuth, profileController.userProfile);
router.get("/orderdetails", userAuth, userController.orderdetails);
router.get("/change-email", userAuth, profileController.changeEmail);
router.post("/change-email", userAuth, profileController.changeEmailValid);
router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changePasswordValid);

// Cart Routes
router.get("/cart", userAuth, userController.loadCart);
router.post("/addToCart", userAuth, userController.cart);
router.post("/addToCart/update", userAuth, userController.updateCart);
router.post("/addToCart/remove", userAuth, userController.removeFromCart);
router.post("/update-quantity", userAuth, cartController.updateQuantity);
router.post("/deleteItem", userAuth, cartController.removeFromCart);
router.get("/refresh-cart", userAuth, cartController.refreshCart);

// Address Management
router.get("/address", userAuth, profileController.loadAddressPage);
router.get("/addAddress", userAuth, profileController.addAddress);
router.post("/addAddress", userAuth, profileController.postAddAddress);
router.get("/editAddress", userAuth, profileController.editAddress);
router.post("/editAddress", userAuth, profileController.postEditAddress);
router.get("/deleteAddress", userAuth, profileController.deleteAddress);



router.get("/coupon", userAuth, couponController.loadCoupons);
router.post("/coupon/apply", userAuth, couponController.applyCoupon);
router.get("/coupon/getApplied", userAuth, couponController.getAppliedCoupon);
router.post("/coupon/remove", userAuth, couponController.removeCoupon);
router.get("/order-success", userAuth, orderController.renderSuccessPage)



// Checkout Management
router.get("/checkout", userAuth, checkoutController.loadCheckoutPage);
router.get("/addAddressCheckout", userAuth, checkoutController.addAddressCheckout);
router.post("/addAddressCheckout", userAuth, checkoutController.postAddAddressCheckout);

// Order Management - Enhanced Routes with Razorpay Integration
router.post("/placeOrder", userAuth, orderController.placeOrder);
router.post("/createCheckoutOrder", userAuth, orderController.createCheckoutOrder);
router.post("/verifyCheckoutPayment", userAuth, orderController.verifyCheckoutPayment);
router.get("/orders", userAuth, orderController.getOrders);
router.get("/order-details", userAuth, orderController.loadOrderDetails);
router.get("/order-details/:orderId", userAuth, orderController.loadOrderDetails);
router.post("/cancelOrder", userAuth, orderController.cancelOrder);
router.post("/requestReturn", userAuth, orderController.requestReturn);
router.get("/order-success/:orderId", userAuth, orderController.renderSuccessPage);

// Invoice and Order Actions
router.get('/order/:id/invoice', userAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user;
    
    const order = await Order.findOne({ 
      $or: [
        { _id: orderId, userId },
        { orderId: orderId, userId }
      ]
    }).populate('orderedItems.product');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.status !== 'delivered') {
      return res.status(400).send('Invoice can only be generated for delivered orders');
    }

    // Generate and send invoice (simplified version)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    
    // For now, send a simple response. In production, you'd generate an actual PDF
    res.send(`Invoice for Order ${order.orderId} - Amount: ₹${order.finalAmount}`);
    
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
});

// Order Status Updates (for auto-refresh)
router.get('/orders/status-update', userAuth, async (req, res) => {
  try {
    const userId = req.session.user;
    const lastCheck = req.query.lastCheck ? new Date(req.query.lastCheck) : new Date(Date.now() - 30000);
    
    const updatedOrders = await Order.find({
      userId,
      updatedOn: { $gte: lastCheck }
    });

    res.json({
      hasUpdates: updatedOrders.length > 0,
      updatedOrders: updatedOrders.length
    });
  } catch (error) {
    console.error('Error checking order updates:', error);
    res.json({ hasUpdates: false, error: 'Failed to check updates' });
  }
});

// Wishlist Routes
router.get('/wishlist', userAuth, userController.wishlistpage);
router.post('/addToWishlist/:id', userAuth, userController.addToWishlist);
router.delete('/removeFromWishlist/:id', userAuth, userController.removeFromWishlist);

// Wallet Management with Razorpay Integration
router.get('/wallet', userAuth, walletController.loadWallet);
router.post('/wallet/create-razorpay-order', userAuth, walletController.createRazorpayOrder);
router.post('/wallet/verify-payment', userAuth, walletController.verifyPayment);
router.post('/wallet/withdraw-money', userAuth, walletController.withdrawMoney);

// Error Page
router.get("/errorpage", userController.errorpage);

module.exports = router;