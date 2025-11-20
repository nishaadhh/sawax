const User = require('../../models/userSchema');
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")
const Wallet = require("../../models/walletSchema");
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const brand = require('../../models/brandSchema');
const wishlist = require('../../models/userSchema');
const mongoose = require('mongoose');
const path = require("path");
const crypto = require("crypto");
const Cart = require("../../models/cartSchema");

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
            const client = await User.findOne({ _id: user },{ name: 1 ,email :1 , googleId:1 , referId:1 });
            console.log(`\n\n   USER : [ ' ${client.name} ' ] IS ENTERED TO HOME PAGE`);
            console.log(`\n   USER-EMAIL : [ ' ${client.email} ' ] `);
            console.log(`\n   USER GOOGLE-ID : [ ' ${client.googleId} ' ]`);
            console.log(`\n   USER REFER-ID : [ ' ${client.referId} ' ]  \n\n`);
            res.render("home",{user:userData,products})
            
            

            // console.log(userData);
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


const renderForgotPassword = (req, res) => {
  res.render('forgot-password', { message: '' });
};


const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    console.log(email, user);
    if (!user) {
      return res.render('forgot-password', { message: 'Email not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.forgotPasswordOtp = otp;
    req.session.forgotPasswordEmail = email;

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render('forgot-password', { message: 'Failed to send OTP. Please try again.' });
    }

    res.redirect('/otp-verification2');
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).render('forgot-password', { message: 'Server Error' });
  }
};

// Render OTP verification page for forgot password
const renderForgotPasswordOtp = async (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/');
        }
        res.render('otp-verification2');
    } catch (error) {
        res.redirect('/pagenotfound');
    }
};

// Verify forgot password OTP
const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const { otp1, otp2, otp3, otp4, otp5, otp6 } = req.body;
        const otp = otp1.concat(otp2).concat(otp3).concat(otp4).concat(otp5).concat(otp6);
        
        if (otp === req.session.forgotPasswordOtp) {
            req.session.otpVerified = true;
            res.json({ success: true, message: 'OTP verified successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error verifying forgot password OTP:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Resend forgot password OTP
const resendForgotPasswordOtp = async (req, res) => {
    try {
        const email = req.session.forgotPasswordEmail;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Session expired. Please start over.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.forgotPasswordOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error resending forgot password OTP:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Render reset password page
const renderResetPassword = async (req, res) => {
    try {
        if (!req.session.otpVerified) {
            return res.redirect('/forgot-password');
        }
        res.render('reset-password');
        console.log('\n\n USER TRYING TO CHANGE PASSWORD\n\n')
    } catch (error) {
        res.redirect('/pagenotfound');
    }
};


const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.session.forgotPasswordEmail;

    if (!email || !req.session.otpVerified) {
      return res.status(400).json({ status: false, message: 'Session expired. Please start over.' });
    }

    // password validation
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!minLength || !hasUpperCase || !hasNumber) {
      const errors = [];
      if (!minLength) errors.push('Password must be at least 8 characters');
      if (!hasUpperCase) errors.push('Password must include at least one capital letter');
      if (!hasNumber) errors.push('Password must include at least one number');
      return res.status(400).json({ status: false, message: errors.join(', ') });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    // Clear session data
    req.session.forgotPasswordEmail = null;
    req.session.forgotPasswordOtp = null;
    req.session.otpVerified = null;

    res.json({ status: true, message: 'Password updated successfully.' });
    console.log('\n\nUSER CHANGED CURRENT PASSWORD\n\n')
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ status: false, message: 'Server Error' });
  }
};

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
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
    }
});


// console.log(process.env.NODEMAILER_EMAIL);
// console.log(process.env.NODEMAILER_PASSWORD);





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

// process referral bonuses
const processReferralBonus = async (newUser, referrerCode) => {
    try {
        if (!referrerCode) return;

        // Find the referrer by their referral code
        const referrer = await User.findOne({ referId: referrerCode });
        if (!referrer) {
            console.log('Invalid referral code:', referrerCode);
            return;
        }

        // Don't allow self-referral
        if (referrer._id.toString() === newUser._id.toString()) {
            console.log('Self-referral attempted');
            return;
        }

        // Create or update referrer's wallet
        let referrerWallet = await Wallet.findOne({ userId: referrer._id });
        if (!referrerWallet) {
            referrerWallet = new Wallet({
                userId: referrer._id,
                balance: 0,
                refundAmount: 0,
                totalDebited: 0,
                transactions: []
            });
        }

        // Create or update new user wallet
        let newUserWallet = await Wallet.findOne({ userId: newUser._id });
        if (!newUserWallet) {
            newUserWallet = new Wallet({
                userId: newUser._id,
                balance: 0,
                refundAmount: 0,
                totalDebited: 0,
                transactions: []
            });
        }

        // Add referral bonus to referrer ₹100
        const referralBonus = 100;
        referrerWallet.balance += referralBonus;
        referrerWallet.transactions.push({
            amount: referralBonus,
            type: 'credit',
            description: `Referral bonus for inviting ${newUser.name}`,
            transactionPurpose: 'referral_bonus',
            referenceId: `REF_${newUser._id}`,
            status: 'COMPLETED',
            date: new Date()
        });

        // Add joining bonus to new user ₹50
        const joiningBonus = 50;
        newUserWallet.balance += joiningBonus;
        newUserWallet.transactions.push({
            amount: joiningBonus,
            type: 'credit',
            description: `Welcome bonus for joining SAWAX`,
            transactionPurpose: 'joining_bonus',
            referenceId: `JOIN_${newUser._id}`,
            status: 'COMPLETED',
            date: new Date()
        });

        // Update user documents
        referrer.referredUsers.push({
            userId: newUser._id,
            name: newUser.name,
            email: newUser.email,
            joinedDate: new Date(),
            bonusEarned: referralBonus
        });
        referrer.totalReferralEarnings += referralBonus;

        newUser.referredBy = referrerCode;
        newUser.joiningBonus = joiningBonus;

        
        await referrerWallet.save();
        await newUserWallet.save();
        await referrer.save();
        await newUser.save();

        console.log(`Referral bonuses processed: Referrer (${referrer.name}) got ₹${referralBonus}, New user (${newUser.name}) got ₹${joiningBonus}`);
    } catch (error) {
        console.error('Error processing referral bonus:', error);
    }
};

const signUp = async (req, res) => {
    try {
        let { name, email, password, cPassword, referralCode } = req.body;

        name = name?.trim();
        email = email?.trim();
        password = password?.trim();
        cPassword = cPassword?.trim();
        referralCode = referralCode?.trim();

        if (!name || !email || !password || !cPassword) {
            return res.render("signup", { message: "All fields are required" });
        }

        const nameRegex = /^[A-Za-z\s]+$/;
        if (!nameRegex.test(name)) {
            return res.render("signup", { message: "Name must contain letters only" });
        }

        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        if (!emailRegex.test(email)) {
            return res.render("signup", { message: "Invalid email format" });
        }

        const hasLetter = /[a-zA-Z]/;
        const hasDigit = /\d/;
        const hasCapital = /[A-Z]/;

        if (
            password.length < 8 ||
            !hasLetter.test(password) ||
            !hasDigit.test(password) ||
            !hasCapital.test(password)
        ) {
            return res.render("signup", {
                message: "Password must be 8 chars, include letters, numbers & 1 capital letter"
            });
        }

        if (password !== cPassword) {
            return res.render("signup", { message: "Passwords do not match" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render("signup", {
                message: "User already exists with this email"
            });
        }

        let referrer = null;
        if (referralCode) {
            referrer = await User.findOne({ referId: referralCode });
            if (!referrer) {
                return res.render("signup", { message: "Invalid referral code" });
            }
        }

        const otp = generateOTP();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.render("signup", {
                message: "Failed to send OTP. Please try again."
            });
        }

        req.session.userOtp = otp;
        req.session.userData = {
            name,
            email,
            password,
            referralCode: referrer ? referralCode : null,
        };

        return res.render("verify-otp");

    } catch (error) {
        console.error("Signup Error:", error);
        return res.redirect("/pagenotfound");
    }
};


const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        throw error;
    }
};


const verifyOtp = async (req, res) => {
    try{
        const {otp1,otp2,otp3,otp4,otp5,otp6} = req.body;
        const otp = otp1.concat(otp2).concat(otp3).concat(otp4).concat(otp5).concat(otp6)

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

            // referral bonus if referral code was provided
            if (user.referralCode) {
                await processReferralBonus(saveUserData, user.referralCode);
            }

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
            res.status(200).json({success:true,message:'Successfully sent OTP'})
        }
    } catch (error) {
        console.error('Error Resending OTP',error)
        res.status(500).json({success:false,message:'Internal Server Error, Please try again'})
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
        const {email, password} = req.body;
        
        
        if (!password) {
            return res.render('login', {message: 'Password is required'});
        }
        
        const findUser = await User.findOne({isAdmin: 0, email: email});

        if (!findUser) {
            return res.render('login', {message: 'User not found'});
        }
        
        if (findUser.isBlocked) {
            return res.render('login', {message: 'User is Blocked by Admin'});
        }

        
        if (!findUser.password) {
            return res.render('login', {message: 'This account was created with Google. Please use Google Sign-In.'});
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            return res.render('login', {message: 'Invalid Password'});
        }

        req.session.user = findUser._id;
        res.redirect('/');
        
    } catch (error) {
        console.error('Login Error', error);
        res.render('login', {message: 'Login Failed Try again'});
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destruction error:", err.message);
                return res.redirect('/pageNotFound');
            }
            console.log('\n\n user logged out')
            return res.redirect('/login?refresh=true');
        });
    } catch (error) {
        console.log("Logout error:", error);
        res.redirect("/pageNotFound");
    }
};

const about=async(req,res)=>{
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        res.render("about",{user})
    } catch (error) {
        console.log('error',error)
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
            maxPrice: 40000,
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

        // Alphabet filter
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
                    sortObj.salesCount = -1; 
                    break;
                default:
                    sortObj.createdAt = -1;
            }
        } else {
            sortObj.createdAt = -1;
        }

        
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

        
        if (isAjax) {
            return res.json({
                products,
                totalProducts,
                totalPages,
                currentPage
            });
        }

        
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





const errorpage =async(req,res)=>{
    try {
        res.render("errorpage")
    } catch (error) {
        
    }
}

const loadProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    
    const product = await Product.findOne({
      _id: productId,
      isBlocked: false,
      status: 'available'
    }).populate('category');

    
    if (!product) {
         const user = req.session.user;
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
        }
      return res.status(404).render('failure-order', {
        user: userData,
        message: 'Product not found or unavailable',
        title: 'Product Not Available'
      });
    }

    const user = req.session.user ? await User.findById(req.session.user) : null;

    res.render('productDetails', { 
      product, 
      user, 
      stock: product.quantity 
    });
  } catch (error) {
    console.log('Error loading product details:', error);
    res.status(500).render('failure-order', { 
      message: 'Something went wrong. Please try again later.' 
    });
  }
};


const cart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.session.user;

    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to add items to cart" });
    }

    
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be a positive integer" });
    }

    // Check product exist and stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (product.quantity < quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.quantity} items in stock` });
    }

    // Use salePrice directly - it already has the discount applied
    const effectivePrice = product.salePrice;
    
    if (typeof effectivePrice !== 'number' || isNaN(effectivePrice) || effectivePrice <= 0) {
      return res.status(400).json({ success: false, message: "Invalid product price" });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if product is in cart and quantity limit
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    let newQuantity = quantity;
    if (itemIndex > -1) {
      newQuantity = cart.items[itemIndex].quantity + quantity;
      if (newQuantity > 5) {
        return res.status(400).json({ success: false, message: "User limit exceeded: Maximum 5 items per product allowed in cart" });
      }
      // Update existing item
      cart.items[itemIndex].quantity = newQuantity;
      cart.items[itemIndex].totalPrice = effectivePrice * newQuantity;
    } else {
      if (quantity > 5) {
        return res.status(400).json({ success: false, message: "User limit exceeded: Maximum 5 items per product allowed in cart" });
      }
      // Add new item
      cart.items.push({
        productId,
        quantity,
        price: effectivePrice,
        totalPrice: effectivePrice * quantity,
        status: "placed",
        cancellationReason: "none",
      });
    }

    // Validate total quantity against stock
    if (newQuantity > product.quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.quantity} items in stock` });
    }

    
    await cart.save();

    res.status(200).json({ success: true, message: "Product added to cart" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ status: false, message: "Please log in first" });
    }

    // checking the cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ status: false, message: "Cart not found" });
    }

    // checking item index in the cart
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

const loadCart = async (req, res) => {
  try {
    const userId = req.session.user;

    
    if (!userId) {
      if (req.xhr || req.headers.accept.includes('json')) {
        return res.status(401).json({ success: false, message: 'Please log in to view cart', redirect: '/login' });
      }
      return res.redirect('/login');
    }

    
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

        // Use salePrice directly - it already has the discount applied
        const effectivePrice = item.productId.salePrice;

        // Checking for price changes
        if (item.price !== effectivePrice) {
          item.price = effectivePrice;
          item.totalPrice = item.quantity * effectivePrice;
          priceChanged = true;
          isUpdated = true;
        }

        // checking if product stock is less than cart quantity
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

      //  if updates were made in cart then save
      if (isUpdated) {
        await cart.save();
      }
    }

    // Display message from query
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
      
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      
      const effectivePrice = product.salePrice;
      
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
        const userId = req.session.user; 
        if (!userId) {
            return res.status(401).json({ message: 'Please log in to add an address.' });
        }

        
        const {
            fullName,
            streetAddress,
            city,
            state,
            zipCode,
            phone,
            addressType = 'Home', 
            altPhone = '', 
        } = req.body;

        
        const errors = [];

        
        if (!fullName || typeof fullName !== 'string' || !/^[A-Za-z\s]{2,}$/.test(fullName)) {
            errors.push('Full Name must be at least 2 characters, letters and spaces only.');
        }

        
        if (!streetAddress || typeof streetAddress !== 'string' || streetAddress.length < 5) {
            errors.push('Street Address must be at least 5 characters.');
        }

        
        if (!city || typeof city !== 'string' || !/^[A-Za-z\s]{2,}$/.test(city)) {
            errors.push('City must be at least 2 characters, letters and spaces only.');
        }

        
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

        

        const pincode = parseInt(zipCode, 10);
        if (!zipCode || !/^\d{5,6}$/.test(zipCode) || isNaN(pincode)) {
            errors.push('Pin Code must be 5 or 6 digits.');
        }

       
        if (!phone || !/^\d{10}$/.test(phone)) {
            errors.push('Phone Number must be exactly 10 digits.');
        }

        
        if (altPhone && !/^\d{10}$/.test(altPhone)) {
            errors.push('Alternate Phone Number must be exactly 10 digits if provided.');
        }

        
        if (!addressType || typeof addressType !== 'string') {
            errors.push('Address Type must be a valid string.');
        }

        
        if (errors.length > 0) {
            return res.status(400).json({ message: errors.join(' ') });
        }

        
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

        
        let userAddress = await Address.findOne({ userId });

        if (userAddress) {
            
            userAddress.address.push(newAddress);
            await userAddress.save();
        } else {
           
            userAddress = new Address({
                userId,
                address: [newAddress],
            });
            await userAddress.save();
        }

        // Return the new added address
        res.status(200).json(newAddress);
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ message: 'An error occurred while saving the address.' });
    }
}



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

        // discount applied
        const effectivePrice = product.salePrice;
        
        user.wishlist.push({
            id: productId,
            image: product.productImage[0],
            name: product.productName,
            price: effectivePrice
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



// Load referral page
const loadReferralPage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Get wallet information for referral
        const wallet = await Wallet.findOne({ userId });

        res.render('referral', {
            user,
            wallet: wallet || { balance: 0, transactions: [] },
            referralCode: user.referId,
            referredUsers: user.referredUsers || [],
            totalEarnings: user.totalReferralEarnings || 0,
            joiningBonus: user.joiningBonus || 0
        });
    } catch (error) {
        console.error('Error loading referral page:', error);
        res.status(500).send('Server Error');
    }
};

// Validate referral code 
const validateReferralCode = async (req, res) => {
    try {
        const { referralCode } = req.body;
        
        if (!referralCode || !referralCode.trim()) {
            return res.json({ valid: false, message: 'Please enter a referral code' });
        }

        const referrer = await User.findOne({ referId: referralCode.trim() });
        
        if (!referrer) {
            return res.json({ valid: false, message: 'Invalid referral code' });
        }

        return res.json({ 
            valid: true, 
            message: `Valid referral code from ${referrer.name}`,
            referrerName: referrer.name 
        });
    } catch (error) {
        console.error('Error validating referral code:', error);
        res.status(500).json({ valid: false, message: 'Server error' });
    }
};

const couponload = async (req, res) => {
    try {
        res.render('coupon');
    } catch (error) {   
        console.error('Error loading coupons page:', error);
    }
}


const location = async(req,res)=>{
    try{
        res.render('locat')
    }
catch(error){
    console.log("errrrrrrrrr")
}    }

module.exports = {
    loadHomePage,
    location,
    pageNotFound,
    loadLoginPage,
    loadSignUpPage,
    signUp,
    login,
    verifyOtp,
    resendOtp,
    logout,
    about,
    // checkout,
    shop,
    loadShoppingPage,
    wishlistpage,
    addToWishlist,
    removeFromWishlist,
    errorpage,
    loadProductDetails,
    filterProduct,
    cart,
    updateCart,
    removeFromCart,
    loadCart,
    addAddress,
    resetPassword,
    renderForgotPassword, 
    forgotPassword,
    renderForgotPasswordOtp,
    verifyForgotPasswordOtp,  
    resendForgotPasswordOtp,
    renderResetPassword,
    couponload,
    loadReferralPage,
    validateReferralCode
}