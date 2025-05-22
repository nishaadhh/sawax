const express = require("express");
const router = express.Router();
const userController = require("../controller/user/userController");
const profileController = require("../controller/user/profileController");
const cartController = require("../controller/user/cartController");
const passport = require("../config/passport");
const { userAuth } = require("../middlewares/auth");
const Order = require('../models/orderSchema')
const userOrderController = require('../controller/user/userOrderController');
const checkoutController = require('../controller/user/checkoutController');
const orderController = require('../controller/user/orderController');

// Home & Pages
router.get("/", userController.loadHomePage);
router.get("/signup", userController.loadSignUpPage);
router.post("/signup", userController.signUp);
router.post("/verify-otp", userController.verifyOtp);
router.get("/resendOtp", userController.resendOtp);
router.get("/product/:id", userController.loadProductDetails);
router.get("/shop", userController.loadShoppingPage);
router.get("/filter",userController.filterProduct);

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

// Static Pages
router.get("/about", userController.about);

// Profile Routes
router.get("/profile", userAuth, profileController.userProfile);
router.get("/orderdetails", userAuth, userController.orderdetails);
router.get("/change-email", userAuth, profileController.changeEmail);
router.post("/change-email", userAuth, profileController.changeEmailValid);
router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changePasswordValid);




// CART 
 

// Existing routes...
router.get("/profile", userAuth, profileController.userProfile);
router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changePasswordValid);
// router.get("/addAddress", userAuth, profileController.addAddress);
// router.post("/addAddress", userAuth, profileController.addAddressValid);

// Cart routes
router.get("/cart", userAuth, userController.loadCart);
router.post("/addToCart", userAuth, userController.cart);
router.post("/addToCart/update", userAuth, userController.updateCart);
router.post("/addToCart/remove", userAuth, userController.removeFromCart);
router.post('/update-quantity', cartController.updateQuantity);

// checkout
// router.get("/checkout", userAuth, userController.checkout);
// router.post('/checkout/address', userAuth, userController.addAddress);
router.post("/deleteItem", cartController.removeFromCart);


//order

router.get('/profile/orders', userAuth, userOrderController.getUserOrders);





//Address Management
router.get("/address",userAuth,profileController.loadAddressPage)
router.get("/addAddress",userAuth,profileController.addAddress)
router.post("/addAddress",userAuth,profileController.postAddAddress)
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress)
router.get("/deleteAddress",userAuth,profileController.deleteAddress)

// Checkout Management
router.get("/checkout",userAuth,checkoutController.loadCheckoutPage)
router.get("/addAddressCheckout",userAuth,checkoutController.addAddressCheckout)
router.post("/addAddressCheckout",userAuth,checkoutController.postAddAddressCheckout)


// Order Management
router.post("/placeOrder", userAuth, orderController.placeOrder);
router.get("/orders", userAuth, orderController.getOrders);
router.get("/order-details", userAuth, orderController.loadOrderDetails);
router.post("/cancelOrder", userAuth, orderController.cancelOrder);

router.get('/filter', userController.filterProduct);

// wishlist
router.get('/wishlist', userController.wishlistpage);
router.post('/addToWishlist/:id', userController.addToWishlist);
router.delete('/removeFromWishlist/:id', userController.removeFromWishlist);

// Error Page
router.get("/errorpage", userController.errorpage);

module.exports = router;