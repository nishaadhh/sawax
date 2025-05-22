const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema"); // Add this to use the Cart model

const loadCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please log in to proceed to checkout"));
    }

    // Fetch the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    // Fetch the cart from the Cart model and populate product and category details
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: {
        path: "category",
        model: "Category"
      }
    });

    // Fetch the user's address
    const addressData = await Address.findOne({ userId });

    // Check if cart exists and has items
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.render("checkout", {
        user,
        cartItems: [],
        subtotal: 0,
        shippingCharge: 0,
        grandTotal: 0,
        userAddress: addressData,
        message: "Your cart is empty"
      });
    }

    // Filter out blocked products and unlisted categories, then map cart items
    const cartItems = cart.items
      .filter(item => 
        item.productId && 
        !item.productId.isBlocked && 
        item.productId.category && 
        item.productId.category.isListed
      )
      .map(item => ({
        product: {
          _id: item.productId._id,
          productName: item.name || item.productId.productName,
          salePrice: item.price || item.productId.salePrice,
          productImage: item.image || (item.productId.productImage && item.productId.productImage[0])
        },
        quantity: item.quantity,
        totalPrice: item.totalPrice || (item.quantity * (item.price || item.productId.salePrice))
      }));

    // Calculate subtotal, shipping charge, and grand total
    const subtotal = cartItems.reduce((total, item) => total + item.totalPrice, 0);
    const shippingCharge = 0; // Free shipping
    const grandTotal = subtotal + shippingCharge;

    // Render the checkout page with the updated cart data
    res.render("checkout", {
      user,
      cartItems,
      subtotal,
      shippingCharge,
      grandTotal,
      userAddress: addressData,
      message: null
    });
  } catch (error) {
    console.error("Error in loadCheckoutPage:", error);
    res.redirect("/pageNotFound");
  }
};

const addAddressCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    res.render("add-address-checkout", {
      theUser: userId,
      user: userData
    });
  } catch (error) {
    console.error("Error in addAddressCheckout:", error);
    res.redirect("/pageNotFound");
  }
};

const postAddAddressCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId });
    const { addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone } = req.body;

    let userAddress = await Address.findOne({ userId });
    
    if (!userAddress) {
      userAddress = new Address({
        userId: userData._id,
        address: [{ addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone }]
      });
      await userAddress.save();
    } else {
      userAddress.address.push({ addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone });
      await userAddress.save();
    }

    res.redirect("/checkout");
  } catch (error) {
    console.error("Error adding address:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  loadCheckoutPage,
  postAddAddressCheckout,
  addAddressCheckout
};