const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/couponSchema"); 


const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

const validatePhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/; 
    return phoneRegex.test(phone);
};

const validatePincode = (pincode) => {
    const pincodeRegex = /^\d{6}$/;
    return pincodeRegex.test(pincode);
};

const validateName = (name) => {
    const nameRegex = /^[a-zA-Z\s]+$/; 
    return nameRegex.test(name.trim());
};

const validateAddressType = (addressType) => {
    const addressTypeRegex = /^[a-zA-Z\s]+$/; 
    return addressTypeRegex.test(addressType.trim());
};

const validateCity = (city) => {
    const cityRegex = /^[a-zA-Z\s]+$/; 
    return cityRegex.test(city.trim());
};

const validateStreetAddress = (address) => {
    const trimmedAddress = address.trim();
    // Must contain at least one letter, can have numbers but not only numbers
    const hasLetters = /[a-zA-Z]/.test(trimmedAddress);
    const validChars = /^[a-zA-Z0-9\s,.-]+$/.test(trimmedAddress);
    const notOnlyNumbers = !/^\d+$/.test(trimmedAddress.replace(/[\s,.-]/g, ''));
    
    return hasLetters && validChars && notOnlyNumbers && trimmedAddress.length >= 5;
};

const validateLandmark = (landmark) => {
    if (!landmark || landmark.trim() === '') return true; 
    const trimmedLandmark = landmark.trim();
    // Must contain at least one letter, can have numbers but not only numbers
    const hasLetters = /[a-zA-Z]/.test(trimmedLandmark);
    const validChars = /^[a-zA-Z0-9\s,.-]+$/.test(trimmedLandmark);
    const notOnlyNumbers = !/^\d+$/.test(trimmedLandmark.replace(/[\s,.-]/g, ''));
    
    return hasLetters && validChars && notOnlyNumbers;
};

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
                user,
                cart: { items: [] },
                addresses: { address: [] },
                subtotal: 0,
                couponDiscount: 0,
                shippingCharge: 50,
                grandTotal: 50,
                message: 'Your cart is empty',
                availableCoupons: [],
                appliedCoupon: null
            });
        }

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
                user,
                cart: { items: [] },
                addresses: { address: [] },
                subtotal: 0,
                couponDiscount: 0,
                shippingCharge: 50,
                grandTotal: 50,
                message: 'No valid items found in cart',
                availableCoupons: [],
                appliedCoupon: null
            });
        }

        if (validCartItems.length !== cart.items.length) {
            cart.items = validCartItems;
            await cart.save();
        }

        const addresses = await Address.findOne({ userId }) || { address: [] };

        const subtotal = validCartItems.reduce((sum, item) => {
            const itemPrice = item.quantity * (item.productId.salePrice || 0);
            return sum + itemPrice;
        }, 0);

        const currentDate = new Date();
        const availableCoupons = await Coupon.find({
            expireOn: { $gt: currentDate },
            isList: true,
            $or: [
                { isPremium: false },
                { isPremium: true, userId: userId }
            ]
        }).sort({ createdOn: -1 });

        const validCoupons = availableCoupons.filter(coupon => {
            const isUsedByUser = coupon.userId.includes(userId);
            const hasReachedLimit = coupon.usedCount >= coupon.usageLimit;
            const meetsMinOrder = subtotal >= coupon.minOrder;
            return !isUsedByUser && !hasReachedLimit && meetsMinOrder;
        }).map(coupon => {
            const daysLeft = Math.ceil((new Date(coupon.expireOn) - currentDate) / (1000 * 60 * 60 * 24));
            return {
                ...coupon.toObject(),
                isUsedByUser: false,
                daysLeft,
                isExpiringSoon: daysLeft <= 7,
                isNew: coupon.createdOn && new Date(coupon.createdOn) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                canUse: true,
                validationMessage: 'Available to use'
            };
        });

        let couponDiscount = 0;
        if (req.session.appliedCoupon) {
            const appliedCoupon = req.session.appliedCoupon;
            if (appliedCoupon.type === 'percentage') {
                couponDiscount = Math.min((subtotal * appliedCoupon.discountValue) / 100, appliedCoupon.maxDiscount || Number.MAX_SAFE_INTEGER);
            } else if (appliedCoupon.type === 'fixed') {
                couponDiscount = Math.min(appliedCoupon.discountValue, appliedCoupon.maxDiscount || Number.MAX_SAFE_INTEGER);
            } else if (appliedCoupon.type === 'shipping') {
                couponDiscount = 50;
            }
        }

        const shippingCharge = req.session.appliedCoupon && req.session.appliedCoupon.type === 'shipping' ? 0 : 50;
        const grandTotal = subtotal - couponDiscount + shippingCharge;

        // applied coupon to view
        res.render('checkout', {
            userData: user,
            user,
            cart: { items: validCartItems },
            addresses,
            subtotal,
            couponDiscount,
            shippingCharge,
            grandTotal,
            message: null,
            availableCoupons: validCoupons,
            appliedCoupon: req.session.appliedCoupon || null  
        });
    } catch (error) {
        console.error('Error loading checkout page:', error);
        res.render('checkout', {
            userData: null,
            user: null,
            cart: { items: [] },
            addresses: { address: [] },
            subtotal: 0,
            couponDiscount: 0,
            shippingCharge: 50,
            grandTotal: 50,
            message: 'Failed to load checkout page',
            availableCoupons: [],
            appliedCoupon: null
        });
    }
};

const addAddressCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log('addAddressCheckout - userId:', userId);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to add address' });
        }

        const { addressType, name, country, state, city, landMark, streetAddress, pincode, phone, email, altPhone } = req.body;

        
        const validationErrors = [];

        // Required field validation
        if (!addressType?.trim()) validationErrors.push('Address type is required');
        if (!name?.trim()) validationErrors.push('Name is required');
        if (!country?.trim()) validationErrors.push('Country is required');
        if (!state?.trim()) validationErrors.push('State is required');
        if (!city?.trim()) validationErrors.push('City is required');
        if (!streetAddress?.trim()) validationErrors.push('Street address is required');
        if (!pincode) validationErrors.push('Pincode is required');
        if (!phone?.trim()) validationErrors.push('Phone number is required');
        if (!email?.trim()) validationErrors.push('Email is required');

        // Format validation
        if (addressType && !validateAddressType(addressType)) {
            validationErrors.push('Address type should contain only letters and spaces');
        }
        if (name && !validateName(name)) {
            validationErrors.push('Name should contain only letters and spaces');
        }
        if (city && !validateCity(city)) {
            validationErrors.push('City should contain only alphabets and spaces');
        }
        if (streetAddress && !validateStreetAddress(streetAddress)) {
            validationErrors.push('Street address must contain letters, can include numbers but cannot be only numbers');
        }
        if (landMark && !validateLandmark(landMark)) {
            validationErrors.push('Landmark must contain letters, can include numbers but cannot be only numbers');
        }
        if (pincode && !validatePincode(pincode.toString())) {
            validationErrors.push('Pincode must be exactly 6 digits');
        }
        if (phone && !validatePhone(phone)) {
            validationErrors.push('Phone number must be 10 digits starting with 6-9');
        }
        if (altPhone && altPhone.trim() && !validatePhone(altPhone)) {
            validationErrors.push('Alternate phone number must be 10 digits starting with 6-9');
        }
        if (email && !validateEmail(email)) {
            validationErrors.push('Please enter a valid email address');
        }

        // Country and state validation (for Indian addresses)
        if (country && country.toLowerCase() !== 'india') {
            validationErrors.push('Currently, we only support Indian addresses');
        }

        if (state && !/^[a-zA-Z\s]+$/.test(state)) {
            validationErrors.push('Please enter a valid Indian state');
        }

        // Check for duplicate phone numbers
        if (phone) {
            const existingAddress = await Address.findOne({
                userId,
                'address.phone': phone
            });
            if (existingAddress) {
                validationErrors.push('An address with this phone number already exists');
            }
        }

        // Return all validation errors
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: validationErrors 
            });
        }

        // Check address limit
        let addressDoc = await Address.findOne({ userId });
        if (!addressDoc) {
            addressDoc = new Address({ userId, address: [] });
        }

        if (addressDoc.address.length >= 5) {
            return res.status(400).json({ 
                success: false, 
                message: 'Maximum 5 addresses allowed per user' 
            });
        }

        // Add the new address
        const newAddress = {
            addressType: addressType.trim(),
            name: name.trim(),
            country: country.trim(),
            state: state.trim(),
            city: city.trim(),
            landMark: landMark?.trim() || '',
            streetAddress: streetAddress.trim(),
            pincode: Number(pincode),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
            altPhone: altPhone?.trim() || ''
        };

        addressDoc.address.push(newAddress);
        await addressDoc.save();

        res.json({ 
            success: true, 
            message: 'Address added successfully',
            addressId: addressDoc.address[addressDoc.address.length - 1]._id
        });
         res.redirect('/checkout')

    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error occurred while adding address'
        });
    }
};


const postAddAddressCheckout = async (req, res) => {
 
    return addAddressCheckout(req, res);
   
};


const validateAddressField = async (req, res) => {
    try {
        const { field, value, userId } = req.body;
        const validationResult = { valid: true, message: '' };

        switch (field) {
            case 'addressType':
                if (!value || !validateAddressType(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'Address type should contain only letters and spaces';
                }
                break;

            case 'name':
                if (!value || !validateName(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'Name should contain only letters and spaces';
                }
                break;

            case 'city':
                if (!value || !validateCity(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'City should contain only alphabets and spaces';
                }
                break;

            case 'streetAddress':
                if (!value || !validateStreetAddress(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'Street address must contain letters, can include numbers but cannot be only numbers';
                }
                break;

            case 'pincode':
                if (!value || !validatePincode(value.toString())) {
                    validationResult.valid = false;
                    validationResult.message = 'Pincode must be exactly 6 digits';
                }
                break;

            case 'phone':
                if (!value || !validatePhone(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'Phone number must be 10 digits starting with 6-9';
                } else if (userId) {
                    // Check for duplicate phone numbers
                    const existingAddress = await Address.findOne({
                        userId,
                        'address.phone': value
                    });
                    if (existingAddress) {
                        validationResult.valid = false;
                        validationResult.message = 'An address with this phone number already exists';
                    }
                }
                break;

            case 'altPhone':
                if (value && value.trim() && !validatePhone(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'Alternate phone number must be 10 digits starting with 6-9';
                }
                break;

            case 'email':
                if (!value || !validateEmail(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'Please enter a valid email address';
                }
                break;

            case 'landMark':
                if (value && !validateLandmark(value)) {
                    validationResult.valid = false;
                    validationResult.message = 'Landmark must contain letters, can include numbers but cannot be only numbers';
                }
                break;

            default:
                validationResult.valid = false;
                validationResult.message = 'Unknown field';
        }

        res.json(validationResult);
    } catch (error) {
        console.error('Error validating field:', error);
        res.status(500).json({ valid: false, message: 'Validation error' });
    }
};









const addCheckoutAddress = async (req,res) => {
    try {
        const user = req.session.user;
        const userData = await User.findById(user);
        res.render("add-address-checkout",{
            theUser:user,
            user:userData
        })
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}






const postAddAddressCheckout2 = async (req,res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id:userId})
        const { addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone } = req.body;

        const userAddress = await Address.findOne({userId:userData._id});
        
        if(!userAddress){
            const newAddress = new Address({
                userId:userData,
                address: [{addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone}]
            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone})
            await userAddress.save();
        }

        res.redirect("/checkout")
    } catch (error) {
        console.error("Error adding address",error)
        res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadCheckoutPage,
    addAddressCheckout,
    postAddAddressCheckout,
    validateAddressField,
    addCheckoutAddress,
    postAddAddressCheckout2
    
    

};