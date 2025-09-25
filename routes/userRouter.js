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
const referralController = require("../controller/user/referralController");
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
// Forgot Password Routes
router.get('/forgot-password', userController.renderForgotPassword);
router.post('/forgot-password', userController.forgotPassword);
router.get('/otp-verification2', userController.renderForgotPasswordOtp);
router.post('/verify-forgot-password-otp', userController.verifyForgotPasswordOtp);
router.post('/resend-forgot-password-otp', userController.resendForgotPasswordOtp);
router.get('/reset-password', userController.renderResetPassword);
router.post('/reset-password', userController.resetPassword);



// Referral Routes

router.get('/referral', userController.loadReferralPage);
router.post('/validate-referral', userController.validateReferralCode);










// Static Pages
router.get("/about", userController.about);

// Profile Routes changed new emaiil 
router.get("/profile", userAuth, profileController.userProfile);
router.post("/userProfile", userAuth, profileController.updateProfile);


// Add these routes to your router
router.post('/upload-profile-image',userAuth, profileController.upload.single('profileImage'), profileController.uploadProfileImage);
router.delete('/remove-profile-image',userAuth, profileController.removeProfileImage);



// router.post("/upload-profile-image", userAuth, profileController.upload.single('profileImage'), profileController.uploadProfileImage);
router.get("/check-username", userAuth, profileController.checkUsernameAvailability);
router.get("/orderdetails", userAuth, userController.orderdetails);
router.get("/change-email", userAuth, profileController.changeEmail);
router.post("/send-current-email-otp", userAuth, profileController.sendCurrentEmailOtp);
router.get("/verify-current-email-otp-page", userAuth, profileController.verifyCurrentEmailOtpPage);
router.post("/verify-current-email-otp", userAuth, profileController.verifyCurrentEmailOtp);
router.post("/resend-current-email-otp", userAuth, profileController.resendCurrentEmailOtp);
router.get("/new-email", userAuth, profileController.newEmailPage);
router.post("/update-new-email", userAuth, profileController.updateNewEmail);
router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changePasswordValid);


// Address Routes
router.get("/address", userAuth, profileController.loadAddressPage);
router.get("/add-address", userAuth, profileController.addAddress);
router.post("/add-address", userAuth, profileController.postAddAddress);
router.get("/edit-address", userAuth, profileController.editAddress);
router.post("/edit-address", userAuth, profileController.postEditAddress);
router.get("/delete-address", userAuth, profileController.deleteAddress);
// Cart Routes
router.get("/cart", userAuth, userController.loadCart);
router.get("/refresh-cart", userAuth, cartController.refreshCart);
router.post("/addToCart", userAuth, userController.cart);
router.post("/addToCart/update", userAuth, userController.updateCart);
router.post("/update-quantity", userAuth, cartController.updateQuantity);
router.post("/addToCart/remove", userAuth, userController.removeFromCart);
router.post("/deleteItem", userAuth, cartController.removeFromCart);

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


const invoiceController = require('../controller/user/invoiceController');

// Invoice Routes
router.get('/order/:id/invoice', userAuth, invoiceController.generateInvoice);



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


module.exports = router;