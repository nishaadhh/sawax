const User = require('../../models/userSchema');
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")
// const Brand = require("../../models/brandSchema")
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const brand = require('../../models/brandSchema');
const wishlist = require('../../models/userSchema');
// controller/user/userController.js
const mongoose = require('mongoose');
const path = require("path");

const Cart = require("../../models/cartSchema");
// const Product = require("../../models/productSchema");                                                                                      



const pageNotFound = async (req, res) => {
    try {
        res.render('page-404')

    } catch (error) {
        res.redirect('/pagenotfound')
    }
}


const loadHomePage = async (req, res) => {
    try {
        
        const user = req.session.user
        const userData = await User.findOne({_id:user})
        const products = await Product.find({isBlocked:0}).limit(8).populate('category').sort({createdAt:-1})


        if(user){

            // console.log(products);
            
                res.render("home",{user:userData,products})
                console.log(userData);
                
            

        }else{

            res.render('home',{
                user:userData,
                products:products
            })
    }
         
        
    } catch (error) {
        console.log('Home Page Not Found')
        res.status(500).send('Server Error')
    }
}

const loadSignUpPage = async (req, res) => {
    try {
        res.render('signup')
    } catch (error) {
        console.log('Sign Up Page Not Found')
        res.status(500).send('Server Error')
    }
}





// Render the forgot password page (GET /forgot-password)
// Renders the Forgot Password page
const renderForgotPassword = (req, res) => {
  res.render('forgot-password', { message: '' });
};


// Handle forgot password form submission (POST /forgot-password)
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('user/forgot-password', { message: 'Email not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = otp;
    req.session.email = email;

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render('user/forgot-password', { message: 'Failed to send OTP. Please try again.' });
    }

    res.redirect('/otp-verification');
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).render('user/forgot-password', { message: 'Server Error' });
  }
};

// Handle resetting the password (POST /reset-password)
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.session.email;

    if (!email) {
      return res.status(400).json({ status: false, message: 'Session expired. Please start over.' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    req.session.email = null;

    res.json({ status: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ status: false, message: 'Server Error' });
  }
};




// Export all functions
// Export both functions


// const forgetpasswordOtp = async (req, res) => {
//     try {
//         if(!req.session.user){
//             return res.render('otp-verification')
//         } else{
//             res.redirect('/')
//         }
//     } catch (error) {
//         res.redirect('/pagenotfound')
//     }
// }






const forgetpasswordOtp  = async (req, res) => {


     try {
        if(!req.session.user){
            return res.render('otp-verification')
        } else{
            res.redirect('/')
        }
    
    try{
        const {otp1,otp2,otp3,otp4,otp5,otp6} = req.body;

        console.log('OTP',otp1,otp2,otp3,otp4,otp5,otp6)
        const otp = otp1.concat(otp2).concat(otp3).concat(otp4).concat(otp5).concat(otp6)
        console.log(req.session.userOtp)

        if(otp===req.session.userOtp){
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                googleId: user.googleId || null,
                password: passwordHash
            })

            await saveUserData.save();
            req.session.user = saveUserData._id;

            res.json({success:true,redirectUrl:'/'})

        } else{
            res.status(400).json({success:false,message:'Invalid OTP Please try again'})
        }

    } catch (error) {
        console.error('Error verifying OTP',error)
        res.status(500).json({success:false,message:'Server Error'})
    }
    }catch (error) {
        res.redirect('/pagenotfound')
    }
}



























//







function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
      console.log("=== SENDING EMAIL START ===");
      console.log("Target Email:", email);
      console.log("OTP:", otp);
      console.log("From:", process.env.NODEMAILER_EMAIL);

      if (!email) {
          console.error("No email provided.");
          return false;
      }

      const transporter = nodemailer.createTransport({
          service: 'gmail',
          port: 587,
          secure: false,
          requireTLS: true,
          auth: {
              user: process.env.NODEMAILER_EMAIL,
              pass: process.env.NODEMAILER_PASSWORD
          }
      });

      const info = await transporter.sendMail({
          from: process.env.NODEMAILER_EMAIL,
          to: email,
          subject: 'OTP for Verification',
          text: `Your OTP is ${otp}`,
          html: `<b>Your OTP is ${otp}</b>`
      });

      console.log("Email sent successfully:", info.response);
      return info.accepted.length > 0;

  } catch (error) {
      console.error("Error sending email:", error);
      return false;
  }
}





const signUp = async (req, res) => {
   
    try {
        const { name, email, password, cPassword } = req.body
        
        if(password !== cPassword){
            return res.render('signup',{message:'Password not matched'})
        }

        const findUser = await User.findOne({email:email})

        if(findUser){
            return res.render('signup',{message:'User already exists'})
        }

        const otp = generateOTP()

        const emailSent = await sendVerificationEmail(email,otp);

        // if(!emailSent){
        //     return res.json("email-error")
        // }
        
        req.session.userOtp = otp;
        req.session.userData = {name,email,password};

        res.render('verify-otp');
        console.log("OTP Send",otp);
        

    } catch (error) {
        console.error('signup error',error)
        res.redirect('/pagenotfound')
    }
}

const securePassword = async (password) => {
    try {
        
        const passwordHash = await bcrypt.hash(password,10);

        return passwordHash;

    } catch (error) {
        
    }
}


const verifyOtp = async (req, res) => {
    try{
        const {otp1,otp2,otp3,otp4,otp5,otp6} = req.body;

        console.log('OTP',otp1,otp2,otp3,otp4,otp5,otp6)
        const otp = otp1.concat(otp2).concat(otp3).concat(otp4).concat(otp5).concat(otp6)
        console.log(req.session.userOtp)

        if(otp===req.session.userOtp){
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                googleId: user.googleId || null,
                password: passwordHash
            })

            await saveUserData.save();
            req.session.user = saveUserData._id;

            res.json({success:true,redirectUrl:'/'})

        } else{
            res.status(400).json({success:false,message:'Invalid OTP Please try again'})
        }

    } catch (error) {
        console.error('Error verifying OTP',error)
        res.status(500).json({success:false,message:'Server Error'})
    }
}


const resendOtp = async (req, res) => {
    try {

        const {email} = req.session.userData;
        console.log('email:',email)
        if(!email){
            return res.status(400).json({success:false,message:'Email not found in session'})
        }

        const otp = generateOTP();

        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);
        console.log(emailSent)
        if(!emailSent){
            res.status(500).json({success:false,message:'Failed to resend OTP Please try again'})
            
        } else{
            console.log("Resend OTP",otp);
            res.status(200).json({success:true,message:'Succesfully sent OTP'})
        }

    } catch (error) {

        console.error('Error Resending OTP',error)
        res.status(500).json({success:false,message:'INternal Server Error, Please try again'})
        
    }
}

const loadLoginPage = async (req, res) => {
    try {
        if(!req.session.user){
            return res.render('login')
        } else{
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pagenotfound')
    }
}


const login = async (req, res) => {
    try {
        
        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            return res.render('login',{message:'User not found'})
        }
        if(findUser.isBlocked){
            return res.render('login',{message:'User is Blocked by Admin'})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render('login',{message:'Invalid Password'})
        }

        req.session.user = findUser._id;
        res.redirect('/')

    } catch (error) {

        console.error('Login Error',error);
        res.render('login',{message:'Login Failed Try again'})
        
        
    }
}


const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destruction error:", err.message);
                return res.redirect('/pageNotFound');
            }
            // Redirect to /login with refresh query parameter
            return res.redirect('/login?refresh=true');
        });
    } catch (error) {
        console.log("Logout error:", error);
        res.redirect("/pageNotFound");
    }
};



const about=async(req,res)=>{
    try {
        res.render("about")
    } catch (error) {
        
    }
}

const shop=async(req,res)=>{
    try {
        res.render("shop")
    } catch (error) {
        
    }
}

const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
        }

        const categories = await Category.find({ isListed: true });
        const categoryIDs = categories.map(cat => cat._id);

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const queryObj = {
            isBlocked: false,
            category: { $in: categoryIDs },
            quantity: { $gt: 0 }
        };

        const sortObj = { createdAt: -1 };

        const products = await Product.find(queryObj)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .lean();

        console.log('Initial Load Products:', products.length);

        const totalProducts = await Product.countDocuments(queryObj);
        const totalPages = Math.ceil(totalProducts / limit);

        const categoriesWithCounts = await Promise.all(
            categories.map(async (cat) => {
                const count = await Product.countDocuments({
                    category: cat._id,
                    isBlocked: false,
                    quantity: { $gt: 0 }
                });
                return { _id: cat._id, name: cat.name, productCount: count };
            })
        );

        res.render('shop', {
            user: userData,
            products,
            category: categoriesWithCounts,
            totalProducts,
            currentPage: page,
            totalPages,
            selectedCategory: null,
            searchQuery: '',
            minPrice: 0,
            maxPrice: 1000,
            sort: 'relevance',
            alphaFilter: ''
        });
    } catch (error) {
        console.error('Shopping Page Not Found:', error);
        res.redirect('/pagenotfound');
    }
};


const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const { category, query, minPrice, maxPrice, alpha, sort, page = 1 } = req.query;
        const isAjax = req.xhr || req.headers.accept.includes('json');

        // Fetch all listed categories
        const categories = await Category.find({ isListed: true });
        const categoryIDs = categories.map(cat => cat._id);

        const queryObj = {
            isBlocked: false,
            quantity: { $gt: 0 },
            category: { $in: categoryIDs } // Default to all listed categories
        };

        // Category filter
        if (category) {
            const findCategory = await Category.findOne({ _id: category, isListed: true });
            if (findCategory) {
                queryObj.category = findCategory._id;
            } else {
                console.warn('Invalid category ID:', category);
                // Keep default category filter instead of leaving it undefined
            }
        }

        // Search filter
        if (query && query.trim()) {
            queryObj.$or = [
                { productName: { $regex: query.trim(), $options: 'i' } },
                { description: { $regex: query.trim(), $options: 'i' } }
            ];
        }

        // Price filter
        if (minPrice || maxPrice) {
            queryObj.salePrice = {};
            const min = minPrice ? parseFloat(minPrice) : 0;
            const max = maxPrice ? parseFloat(maxPrice) : Infinity;
            if (min > 0) queryObj.salePrice.$gte = min;
            if (max < Infinity) queryObj.salePrice.$lte = max;
        }

        // Alphabetical filter
        if (alpha) {
            let regex;
            switch (alpha) {
                case 'a-f':
                    regex = '^[a-fA-F]';
                    break;
                case 'g-l':
                    regex = '^[g-lG-L]';
                    break;
                case 'm-r':
                    regex = '^[m-rM-R]';
                    break;
                case 's-z':
                    regex = '^[s-zS-Z]';
                    break;
                default:
                    regex = null;
            }
            if (regex) {
                queryObj.productName = { $regex: regex, $options: 'i' };
            }
        }

        // Pagination
        const itemsPerPage = 9;
        const currentPage = parseInt(page) || 1;
        const skip = (currentPage - 1) * itemsPerPage;

        // Sorting
        const sortObj = {};
        if (sort) {
            switch (sort) {
                case 'price-low':
                    sortObj.salePrice = 1;
                    break;
                case 'price-high':
                    sortObj.salePrice = -1;
                    break;
                case 'newest':
                    sortObj.createdAt = -1;
                    break;
                case 'bestselling':
                    sortObj.salesCount = -1; // Assume salesCount exists, or remove if not used
                    break;
                default:
                    sortObj.createdAt = -1;
            }
        } else {
            sortObj.createdAt = -1;
        }

        // Fetch products
        const products = await Product.find(queryObj)
            .sort(sortObj)
            .skip(skip)
            .limit(itemsPerPage)
            .lean();

        console.log(`Page ${currentPage} Products:`, products.length, 'Total Products:', await Product.countDocuments(queryObj));

        // Total products for pagination
        const totalProducts = await Product.countDocuments(queryObj);
        const totalPages = Math.ceil(totalProducts / itemsPerPage);

        // Categories with counts
        const categoriesWithCounts = await Promise.all(
            categories.map(async (cat) => {
                const count = await Product.countDocuments({
                    category: cat._id,
                    isBlocked: false,
                    quantity: { $gt: 0 }
                });
                return { _id: cat._id, name: cat.name, productCount: count };
            })
        );

        // User data and search history
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData && (query || category || alpha)) {
                const searchEntry = {
                    category: category || null,
                    searchedOn: new Date(),
                    query: query || null,
                    alpha: alpha || null
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        // Handle AJAX request
        if (isAjax) {
            return res.json({
                products,
                totalProducts,
                totalPages,
                currentPage
            });
        }

        // Render shop page for non-AJAX
        res.render('shop', {
            user: userData,
            products,
            category: categoriesWithCounts,
            totalProducts,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            searchQuery: query || '',
            minPrice: minPrice || 0,
            maxPrice: maxPrice || 1000,
            sort: sort || 'relevance',
            alphaFilter: alpha || ''
        });
    } catch (error) {
        console.error('Error while filtering products:', error);
        if (req.xhr || req.headers.accept.includes('json')) {
            return res.status(500).json({ error: 'Server error' });
        }
        res.redirect('/pageNotFound');
    }
};


// const men =async(req,res)=>{
//     try {
//         res.render("men")
//     } catch (error) {
//         res.redirect('/pagenotfound')
//     }
// }

const profile =async(req,res)=>{
    try {
        res.render("profile")
    } catch (error) {
        // error('Profile Page Not Found')
        // res.redirect('/pagenotfound')
    }
}

const orderdetails =async(req,res)=>{
    try {
        res.render("orderdetails")
    } catch (error) {
        
    }
}




const errorpage =async(req,res)=>{
    try {
        res.render("errorpage")
    } catch (error) {
        
    }
}



const loadProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(404).send('Product not found');
        }
        const user = req.session.user ? await User.findById(req.session.user) : null;
        res.render('productDetails', { product, user ,stock:product.quantity}); 
    } catch (error) {
        console.log('Product Details Page Not Found:', error);
        res.status(500).send('Server Error');
    }
};

 



const cart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.session.user;

    // Check if user is logged in
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to add items to cart" });
    }

    // Validate inputs
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive integer" });
    }

    // Check product existence and stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (product.quantity < quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.quantity} items in stock` });
    }

    // Validate price
    const productPrice = product.salePrice; // Replace with product.price if correct
    if (typeof productPrice !== 'number' || isNaN(productPrice) || productPrice <= 0) {
      return res.status(400).json({ success: false, message: "Invalid product price" });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if product is in cart and enforce quantity limit
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    let newQuantity = quantity;
    if (itemIndex > -1) {
      newQuantity = cart.items[itemIndex].quantity + quantity;
      if (newQuantity > 5) {
        return res.status(400).json({ success: false, message: "User limit exceeded: Maximum 5 items per product allowed in cart" });
      }
      // Update existing item
      cart.items[itemIndex].quantity = newQuantity;
      cart.items[itemIndex].totalPrice = productPrice * newQuantity;
    } else {
      if (quantity > 5) {
        return res.status(400).json({ success: false, message: "User limit exceeded: Maximum 5 items per product allowed in cart" });
      }
      // Add new item
      cart.items.push({
        productId,
        quantity,
        price: productPrice,
        totalPrice: productPrice * quantity,
        status: "placed",
        cancellationReason: "none",
      });
    }

    // Validate total quantity against stock
    if (newQuantity > product.quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.quantity} items in stock` });
    }

    // Save cart
    await cart.save();

    res.status(200).json({ success: true, message: "Product added to cart" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// const updateCart = async (req, res) => {
//   try {
//     const { productId, quantity } = req.body;
//     const userId = req.session.user;

//     if (!productId || quantity < 1) {
//       return res.status(400).json({ message: "Invalid product ID or quantity" });
//     }

//     const cart = await Cart.findOne({ userId });
//     if (!cart) {
//       return res.status(404).json({ message: "Cart not found" });
//     }

//     const item = cart.items.find(item => item.productId.toString() === productId);
//     if (item) {
//       item.quantity = quantity;
//       item.totalPrice = item.price * quantity;
//       await cart.save();
//       res.status(200).json({ message: "Cart updated" });
//     } else {
//       res.status(404).json({ message: "Item not found in cart" });
//     }
//   } catch (error) {
//     console.error("Error updating cart:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ status: false, message: "Please log in first" });
    }

    // Find the cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ status: false, message: "Cart not found" });
    }

    // Find item index in the cart
    const cartItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (cartItemIndex === -1) {
      return res.status(404).json({ status: false, message: "Product not found in cart" });
    }

    // Remove the item
    cart.items.splice(cartItemIndex, 1);
    await cart.save();

    return res.json({ status: true, message: "Product removed from cart" });
  } catch (error) {
    console.error('Error in removeFromCart:', error);
    return res.status(500).json({ status: false, message: "An error occurred while removing the product from cart" });
  }
};


 // controller/user/userController.js
const loadCart = async (req, res) => {
  try {
    const userId = req.session.user;

    // Check if user is logged in
    if (!userId) {
      if (req.xhr || req.headers.accept.includes('json')) {
        return res.status(401).json({ success: false, message: 'Please log in to view cart', redirect: '/login' });
      }
      return res.redirect('/login');
    }

    // Fetch user and cart data
    const userData = await User.findOne({ _id: userId });
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    let cartItems = [];
    let isUpdated = false;
    let priceChanged = false;

    if (cart && cart.items.length > 0) {
      cartItems = cart.items.map((item) => {
        if (!item.productId) {
          console.warn(`Product not found for item: ${item.productId}`);
          return null;
        }

        // Check for price changes
        const effectivePrice = item.productId.salePrice * (1 - (item.productId.productOffer || 0) / 100);
        if (item.price !== effectivePrice) {
          item.price = effectivePrice;
          item.totalPrice = item.quantity * effectivePrice;
          priceChanged = true;
          isUpdated = true;
        }

        // Sync quantity if product stock is less than cart quantity
        if (item.productId.quantity < item.quantity) {
          item.quantity = item.productId.quantity;
          item.totalPrice = item.quantity * item.price;
          isUpdated = true;
        }

        return {
          productId: item.productId._id,
          name: item.productId.productName,
          image:
            item.productId.productImage && item.productId.productImage.length > 0
              ? `/${item.productId.productImage[0]}`
              : '/placeholder.svg',
          price: item.price,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          stock: item.productId.quantity,
        };
      }).filter(item => item !== null);

      // Save only if updates were made
      if (isUpdated) {
        await cart.save();
      }
    }

    // Optional: Display message from query
    const message = req.query.message ? decodeURIComponent(req.query.message) : null;

    // Render cart
    res.render('cart', {
      user: userData,
      cart: cartItems,
      message,
      priceChanged
    });

  } catch (error) {
    console.error('Error loading cart:', error);
    if (req.xhr || req.headers.accept.includes('json')) {
      return res.status(500).json({ success: false, message: 'Server error while loading cart' });
    }
    res.redirect('/errorpage?message=cart-load-error');
  }
};

const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;
    if (!productId || quantity < 1) {
      return res.status(400).json({ message: "Invalid product ID or quantity" });
    }
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    const item = cart.items.find(item => item.productId._id.toString() === productId);
    if (item) {
      // Update price to reflect current product price
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      const effectivePrice = product.salePrice * (1 - (product.productOffer || 0) / 100);
      item.quantity = quantity;
      item.price = effectivePrice;
      item.totalPrice = quantity * effectivePrice;
      await cart.save();
      res.status(200).json({ message: "Cart updated", price: effectivePrice });
    } else {
      res.status(404).json({ message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const addAddress = async (req, res) => {
    try {
        // Check if user is authenticated
        const userId = req.session.user; // Assuming user ID is stored in session
        if (!userId) {
            return res.status(401).json({ message: 'Please log in to add an address.' });
        }

        // Extract data from request body
        const {
            fullName,
            streetAddress,
            city,
            state,
            zipCode,
            phone,
            addressType = 'Home', // Default to 'Home' if not provided
            altPhone = '', // Default to empty string if not provided
        } = req.body;

        // Backend validation
        const errors = [];

        // Validate fullName (name)
        if (!fullName || typeof fullName !== 'string' || !/^[A-Za-z\s]{2,}$/.test(fullName)) {
            errors.push('Full Name must be at least 2 characters, letters and spaces only.');
        }

        // Validate streetAddress (landMark)
        if (!streetAddress || typeof streetAddress !== 'string' || streetAddress.length < 5) {
            errors.push('Street Address must be at least 5 characters.');
        }

        // Validate city
        if (!city || typeof city !== 'string' || !/^[A-Za-z\s]{2,}$/.test(city)) {
            errors.push('City must be at least 2 characters, letters and spaces only.');
        }

        // Validate state
        const validStates = [
            'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
            'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
            'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
            'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
            'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
            'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
        ];
        if (!state || !validStates.includes(state)) {
            errors.push('Please select a valid state.');
        }

        // Validate zipCode (pincode)
        const pincode = parseInt(zipCode, 10);
        if (!zipCode || !/^\d{5,6}$/.test(zipCode) || isNaN(pincode)) {
            errors.push('Pin Code must be 5 or 6 digits.');
        }

        // Validate phone
        if (!phone || !/^\d{10}$/.test(phone)) {
            errors.push('Phone Number must be exactly 10 digits.');
        }

        // Validate altPhone (optional, but must be 10 digits if provided)
        if (altPhone && !/^\d{10}$/.test(altPhone)) {
            errors.push('Alternate Phone Number must be exactly 10 digits if provided.');
        }

        // Validate addressType
        if (!addressType || typeof addressType !== 'string') {
            errors.push('Address Type must be a valid string.');
        }

        // If there are validation errors, return them
        if (errors.length > 0) {
            return res.status(400).json({ message: errors.join(' ') });
        }

        // Prepare the new address object
        const newAddress = {
            addressType,
            name: fullName,
            city,
            landMark: streetAddress,
            state,
            pincode,
            phone,
            altPhone,
        };

        // Check if the user already has an Address document
        let userAddress = await Address.findOne({ userId });

        if (userAddress) {
            // If exists, push the new address to the address array
            userAddress.address.push(newAddress);
            await userAddress.save();
        } else {
            // If not, create a new Address document
            userAddress = new Address({
                userId,
                address: [newAddress],
            });
            await userAddress.save();
        }

        // Return the newly added address
        res.status(200).json(newAddress);
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ message: 'An error occurred while saving the address.' });
    }
}

const placeOrder = async (req, res) => {
    try {
        const { address } = req.body;
        const userId = req.session.user;
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || !cart.items.length) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        const user = await User.findById(userId);
        let selectedAddress;

        if (address.addressId !== undefined && user.addresses[address.addressId]) {
            selectedAddress = user.addresses[address.addressId];
        } else {
            selectedAddress = {
                fullName: address.fullName,
                streetAddress: address.streetAddress,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode,
                phone: address.phone,
            };
            user.addresses.push(selectedAddress);
            await user.save();
        }

        const orderItems = cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
        }));

        const total = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

        const order = new Order({
            userId,
            items: orderItems,
            total,
            address: selectedAddress,
        });

        await order.save();
        await Cart.deleteOne({ userId });

        res.status(200).json({ message: "Order placed successfully" });
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "Server error" });
    }
};

const checkout = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const user = await User.findById(userId);
    const addressData = await Address.findOne({ userId });
    if (!cart || !cart.items.length) {
      return res.redirect("/cart?message=Your%20cart%20is%20empty");
    }

    const cartItems = cart.items.map(item => ({
      product: {
        _id: item.productId._id,
        productName: item.productId.productName,
        productImage: item.productId.productImage[0],
      },
      quantity: item.quantity,
      totalPrice: item.totalPrice,
    }));

    const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const shippingCharge = 0; // As per your shipping logic
    const grandTotal = subtotal + shippingCharge;

    res.render("checkout", {
      cartItems,
      user,
      addresses: addressData || { address: [] },
      walletBalance: user.walletBalance || 0,
      subtotal,
      shippingCharge,
      grandTotal
    });
  } catch (error) {
    console.error("Error fetching checkout:", error);
    res.redirect("/errorpage? ..message=checkout-error");
  }
};




const wishlistpage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ message: 'Please log in to view your wishlist.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const wishlistItems = user.wishlist.map(item => ({
            productId: item.id,
            name: item.name,
            image: item.image,
            price: item.price
        }));

        res.render('wishlist', { wishlistItems, user });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).send('Internal Server Error');
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please log in to add to wishlist.' });
        }

        const productId = req.params.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Check if product is already in wishlist
        const exists = user.wishlist.some(item => item.id === productId);
        if (exists) {
            return res.status(400).json({ success: false, message: 'Product already in wishlist.' });
        }

        // Add product to wishlist
        user.wishlist.push({
            id: productId,
            image: product.productImage[0],
            name: product.productName,
            price: product.salePrice
        });

        await user.save();
        res.status(200).json({ success: true, message: 'Product added to wishlist.' });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ message: 'Please log in to remove from wishlist.' });
        }

        const productId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.wishlist = user.wishlist.filter(item => item.id !== productId);
        await user.save();

        res.status(200).json({ message: 'Product removed from wishlist.' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
 



const wallet = async (req, res) => {
    try {
        // Mock data; replace with actual database queries
        const walletBalance = 1500.50; // Fetch from user wallet in DB
        const transactions = [
            { date: new Date(), type: 'Deposit', amount: 1000, description: 'Added funds via UPI' },
            { date: new Date(), type: 'Purchase', amount: 499.50, description: 'Order #1234' }
        ];

        res.render('wallet', {
            walletBalance,
            transactions
        });
    } catch (error) {
        console.error('Error fetching wallet page:', error);
        res.status(500).send('Server Error');
    }
};

const addFunds = async (req, res) => {
    try {
        const { amount } = req.body;
        const amountNum = parseFloat(amount);

        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(500).json({ status: false, message: 'Invalid amount' });
        }

        // Update wallet balance in DB (pseudo-code)
        // await User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: amountNum } });

        // Add transaction to history (pseudo-code)
        // await Transaction.create({
        //     userId: req.user.id,
        //     date: new Date(),
        //     type: 'Deposit',
        //     amount: amountNum,
        //     description: 'Added funds via form'
        // });

        res.json({ status: true, message: 'Funds added successfully' });
    } catch (error) {
        console.error('Error adding funds:', error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
};

// Export the functions (add to your existing exports)


// Export the functions (add to your existing exports)
const couponload = async (req, res) => {
    try {
        res.render('coupon');
    } catch (error) {   
        console.error('Error loading coupons page:', error);
        }
    }

      

module.exports = {
    loadHomePage,
    pageNotFound,
    loadLoginPage,
    loadSignUpPage,
    signUp,
    login,
    verifyOtp,
    resendOtp,
    logout,
    about,
    checkout,
    shop,
    loadShoppingPage,
    profile,
    orderdetails,
    wishlistpage,
    addToWishlist,
    removeFromWishlist,
    errorpage,
    loadProductDetails ,
    filterProduct,
    loadProductDetails,
    cart,
    updateCart,
    removeFromCart,
    loadCart,
    addAddress,
    placeOrder,
    updateCart,
       wallet,
    addFunds,
    resetPassword,
     renderForgotPassword, 
     forgotPassword,
     forgetpasswordOtp,
   couponload


    
}


