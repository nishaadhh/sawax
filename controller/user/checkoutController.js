const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
// const Coupon = require("../../models/Coupon"); // Assuming Coupon model exists

// Enhanced validation utilities
const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

const validatePhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/; // Indian mobile number format
    return phoneRegex.test(phone);
};

const validatePincode = (pincode) => {
    const pincodeRegex = /^\d{6}$/; // Exactly 6 digits
    return pincodeRegex.test(pincode);
};

const validateName = (name) => {
    const nameRegex = /^[a-zA-Z\s]+$/; // Only letters and spaces
    return nameRegex.test(name.trim());
};

const validateAddressType = (addressType) => {
    const addressTypeRegex = /^[a-zA-Z\s]+$/; // Only letters and spaces
    return addressTypeRegex.test(addressType.trim());
};

const validateCity = (city) => {
    const cityRegex = /^[a-zA-Z\s]+$/; // Only alphabets and spaces
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
    if (!landmark || landmark.trim() === '') return true; // Optional field
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
                user,
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
            user,
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
            user,
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
            return res.status(401).json({ success: false, message: 'Please login to add address' });
        }

        const { addressType, name, country, state, city, landMark, streetAddress, pincode, phone, email, altPhone } = req.body;

        // Comprehensive server-side validation
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

        // Check address limit (max 5 addresses per user)
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

    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error occurred while adding address'
        });
    }
};

// Rename to avoid confusion, as this is likely the endpoint for AJAX form submission
const postAddAddressCheckout = async (req, res) => {
    // This function is identical to addAddressCheckout for backward compatibility
    return addAddressCheckout(req, res);
};

// New endpoint for real-time field validation
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

module.exports = {
    loadCheckoutPage,
    addAddressCheckout,
    postAddAddressCheckout,
    validateAddressField
};