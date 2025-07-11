const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
// const Coupon = require("../../models/Coupon"); // Assuming Coupon model exists

const loadCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log('loadCheckoutPage - userId:', userId);

        if (!userId) {
            return res.redirect('/login?message=Please login to access checkout');
        }

        const user = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        console.log('loadCheckoutPage - cart:', cart ? cart.items.map(item => ({
            productId: item.productId?._id,
            productName: item.productId?.productName,
            productImage: item.productId?.productImage,
            quantity: item.quantity,
            totalPrice: item.totalPrice
        })) : 'Cart not found');

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('checkout', {
                userData: user || { name: '', email: '', phone: '' },
                cart: { items: [] },
                addresses: { address: [] },
                subtotal: 0,
                couponDiscount: 0,
                shippingCharge: 50, // As per orderSchema default
                grandTotal: 50, // Only shipping charge when cart is empty
                message: 'Your cart is empty'
            });
        }

        // Filter out items with invalid or missing product references
        const validCartItems = cart.items.filter(item => 
            item.productId && 
            item.productId._id && 
            item.productId.salePrice !== undefined && 
            item.productId.salePrice !== null &&
            item.quantity > 0
        );

        if (validCartItems.length === 0) {
            return res.render('checkout', {
                userData: user || { name: '', email: '', phone: '' },
                cart: { items: [] },
                addresses: { address: [] },
                subtotal: 0,
                couponDiscount: 0,
                shippingCharge: 50,
                grandTotal: 50,
                message: 'No valid items found in cart'
            });
        }

        // Clean cart by removing invalid items if any were filtered out
        if (validCartItems.length !== cart.items.length) {
            cart.items = validCartItems;
            await cart.save();
        }

        const addresses = await Address.findOne({ userId }) || { address: [] };

        // Calculate subtotal properly
        const subtotal = validCartItems.reduce((sum, item) => {
            const itemPrice = item.quantity * (item.productId.salePrice || 0);
            console.log(`Item: ${item.productId.productName}, Quantity: ${item.quantity}, Price: ${item.productId.salePrice}, Total: ${itemPrice}`);
            return sum + itemPrice;
        }, 0);

        console.log('loadCheckoutPage - calculated subtotal:', subtotal);

        // Check for applied coupon in session (if any)
        let couponDiscount = 0;
        if (req.session.coupon) {
            const coupon = await Coupon.findOne({ name: req.session.coupon, isList: true });
            if (coupon && !coupon.userId.includes(userId)) {
                couponDiscount = coupon.offerPrice;
            } else {
                req.session.coupon = null; // Clear invalid coupon
            }
        }

        const shippingCharge = 50; // As per orderSchema default
        const grandTotal = subtotal - couponDiscount + shippingCharge;

        res.render('checkout', {
            userData: user,
            cart: { items: validCartItems },
            addresses,
            subtotal,
            couponDiscount,
            shippingCharge,
            grandTotal,
            message: null
        });
    } catch (error) {
        console.error('Error loading checkout page:', error);
        res.render('checkout', {
            userData: null,
            cart: { items: [] },
            addresses: { address: [] },
            subtotal: 0,
            couponDiscount: 0,
            shippingCharge: 50,
            grandTotal: 50,
            message: 'Failed to load checkout page'
        });
    }
};

const addAddressCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log('addAddressCheckout - userId:', userId);

        if (!userId) {
            return res.redirect('/login?message=Please login to add address');
        }

        const { addressType, name, country, state, city, landMark, streetAddress, pincode, phone, email, altPhone } = req.body;

        // Basic input validation
        if (!addressType || !name || !country || !state || !city || !streetAddress || !pincode || !phone || !email) {
            return res.status(400).json({ success: false, message: 'All required address fields must be provided' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        // Validate phone format (10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone) || (altPhone && !phoneRegex.test(altPhone))) {
            return res.status(400).json({ success: false, message: 'Phone numbers must be 10 digits' });
        }

        let addressDoc = await Address.findOne({ userId });
        if (!addressDoc) {
            addressDoc = new Address({ userId, address: [] });
        }

        addressDoc.address.push({
            addressType,
            name,
            country,
            state,
            city,
            landMark,
            streetAddress,
            pincode: Number(pincode),
            phone,
            email,
            altPhone
        });

        await addressDoc.save();
        res.json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ success: false, message: 'Failed to add address' });
    }
};

// Rename to avoid confusion, as this is likely the endpoint for AJAX form submission
const postAddAddressCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log('postAddAddressCheckout - userId:', userId);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const { addressType, name, country, state, city, landMark, streetAddress, pincode, phone, email, altPhone } = req.body;

        // Basic input validation
        if (!addressType || !name || !country || !state || !city || !streetAddress || !pincode || !phone || !email) {
            return res.status(400).json({ success: false, message: 'All required address fields must be provided' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        // Validate phone format (10 digits)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone) || (altPhone && !phoneRegex.test(altPhone))) {
            return res.status(400).json({ success: false, message: 'Phone numbers must be 10 digits' });
        }

        let addressDoc = await Address.findOne({ userId });
        if (!addressDoc) {
            addressDoc = new Address({ userId, address: [] });
        }

        addressDoc.address.push({
            addressType,
            name,
            country,
            state,
            city,
            landMark,
            streetAddress,
            pincode: Number(pincode),
            phone,
            email,
            altPhone
        });

        await addressDoc.save();
        res.json({ success: true, message: 'Address added successfully' });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ success: false, message: 'Failed to add address' });
    }
};

// New endpoint for applying coupons
// const applyCoupon = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         const { couponCode } = req.body;

//         if (!userId) {
//             return res.status(401).json({ success: false, message: 'User not authenticated' });
//         }

//         if (!couponCode) {
//             return res.status(400).json({ success: false, message: 'Coupon code is required' });
//         }

//         const coupon = await Coupon.findOne({ name: couponCode, isList: true });
//         if (!coupon) {
//             return res.status(400).json({ success: false, message: 'Invalid coupon code' });
//         }

//         if (coupon.userId.includes(userId)) {
//             return res.status(400).json({ success: false, message: 'Coupon already used' });
//         }

//         // Store coupon in session
//         req.session.coupon = couponCode;
//         res.json({ success: true, message: 'Coupon applied successfully', discount: coupon.offerPrice });
//     } catch (error) {
//         console.error('Error applying coupon:', error);
//         res.status(500).json({ success: false, message: 'Failed to apply coupon' });
//     }
// };

module.exports = {
    loadCheckoutPage,
    addAddressCheckout,
    postAddAddressCheckout,
    // applyCoupon
};