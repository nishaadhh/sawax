const Coupon = require("../../models/couponSchema");
const mongoose = require('mongoose');

    const loadCouponManagement = async (req, res) => {
        try {
            const coupons = await Coupon.find().sort({ createdOn: -1 });
            res.render("couponManagement", {
                coupons,
                title: "Coupon Management"
            });
        } catch (error) {
            console.error("Error in loadCouponManagement:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    };

    const addCoupon = async (req, res) => {
        try {
            const {
                title, description, type, discountValue, discountType, code,
                minOrder, maxDiscount, expireOn, usageLimit, isPremium
            } = req.body;

            // checking validation
            if (!title || title.trim() === "") {
                return res.status(400).json({ success: false, message: "Title is required" });
            }
            if (!code || code.trim() === "") {
                return res.status(400).json({ success: false, message: "Coupon code is required" });
            }
            if (!discountType || discountType.trim() === "") {
                return res.status(400).json({ success: false, message: "Discount type is required" });
            }
            if (!expireOn) {
                return res.status(400).json({ success: false, message: "Expiration date is required" });
            }
            if (!usageLimit) {
                return res.status(400).json({ success: false, message: "Usage limit is required" });
            }

            //pending fixed
            const parsedDiscountValue = Number(discountValue);
            const parsedMinOrder = Number(minOrder);
            const parsedMaxDiscount = Number(maxDiscount);
            const parsedUsageLimit = Number(usageLimit);

            if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0 || (type === 'percentage' && parsedDiscountValue > 100)) {
                return res.status(400).json({ success: false, message: "Discount value must be a positive number and not exceed 100% for percentage discounts" });
            }
            if (isNaN(parsedMinOrder) || parsedMinOrder < 0) {
                return res.status(400).json({ success: false, message: "Minimum order must be a non-negative number" });
            }
            if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
                return res.status(400).json({ success: false, message: "Maximum discount must be a non-negative number" });
            }
            if (isNaN(parsedUsageLimit) || parsedUsageLimit <= 0) {
                return res.status(400).json({ success: false, message: "Usage limit must be a positive number" });
            }

            // Vending date validate cheyal
            let parsedExpireOn = new Date(expireOn);
            if (isNaN(parsedExpireOn.getTime())) {
                return res.status(400).json({ success: false, message: "Expiration date must be a valid date" });
            }
            parsedExpireOn.setHours(23, 59, 59, 999);
            if (parsedExpireOn < new Date()) {
                return res.status(400).json({ success: false, message: "Expiration date must be in the future" });
            }

            // min=Order max-orders checking
            if (type === 'percentage' && parsedDiscountValue === 100) {
                if (parsedMaxDiscount !== parsedMinOrder) {
                    return res.status(400).json({ success: false, message: "For 100% discount, Max Discount should equal Min Order to cap the discount properly" });
                }
            } else if (parsedMaxDiscount < parsedDiscountValue) {
                return res.status(400).json({ success: false, message: "Max Discount cannot be less than Discount Value" });
            }

            // Checking duplicate coupon code ndo 
            const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
            if (existingCoupon) {
                return res.status(400).json({ success: false, message: "Coupon code already exists" });
            }

            const newCoupon = new Coupon({
                title: title.trim(),
                description: description || '',
                type,
                discountValue: parsedDiscountValue,
                discountType: discountType.trim(),
                code: code.toUpperCase(),
                minOrder: parsedMinOrder,
                maxDiscount: parsedMaxDiscount,
                expireOn: parsedExpireOn,
                usageLimit: parsedUsageLimit,
                isPremium: isPremium === "true",
                isList: true,
                createdOn: new Date()
            });

            await newCoupon.save();
            res.status(201).json({ success: true, message: "Coupon added successfully", coupon: newCoupon });
            console.log(newCoupon);
        } catch (error) {
            console.error("Error in addCoupon:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    };

    const editCoupon = async (req, res) => {
        try {
            const couponId = req.params.id;
            const {
                title, description, type, discountValue, discountType, code,
                minOrder, maxDiscount, expireOn, usageLimit, isPremium
            } = req.body;

            // Validate required fields
            if (!title || !code || !discountType || !expireOn || !usageLimit) {
                return res.status(400).json({ success: false, message: "Required fields missing" });
            }

            // Validate numeric fields
            const parsedDiscountValue = Number(discountValue);
            const parsedMinOrder = Number(minOrder);
            const parsedMaxDiscount = Number(maxDiscount);
            const parsedUsageLimit = Number(usageLimit);

            if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0 || (type === 'percentage' && parsedDiscountValue > 100)) {
                return res.status(400).json({ success: false, message: "Discount value must be a positive number and not exceed 100% for percentage discounts" });
            }
            if (isNaN(parsedMinOrder) || parsedMinOrder < 0) {
                return res.status(400).json({ success: false, message: "Minimum order must be a non-negative number" });
            }
            if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
                return res.status(400).json({ success: false, message: "Maximum discount must be a non-negative number" });
            }
            if (isNaN(parsedUsageLimit) || parsedUsageLimit <= 0) {
                return res.status(400).json({ success: false, message: "Usage limit must be a positive number" });
            }

            // Validate expiration date
            let parsedExpireOn = new Date(expireOn);
            if (isNaN(parsedExpireOn.getTime())) {
                return res.status(400).json({ success: false, message: "Expiration date must be a valid date" });
            }
            parsedExpireOn.setHours(23, 59, 59, 999);
            if (parsedExpireOn < new Date()) {
                return res.status(400).json({ success: false, message: "Expiration date must be in the future" });
            }

            // Check if coupon exists
            const coupon = await Coupon.findById(couponId);
            if (!coupon) {
                return res.status(404).json({ success: false, message: "Coupon not found" });
            }

            // Check for duplicate coupon code
            const existingCoupon = await Coupon.findOne({ code: code.toUpperCase(), _id: { $ne: couponId } });
            if (existingCoupon) {
                return res.status(400).json({ success: false, message: "Coupon code already exists" });
            }

            // Validate max discount against discount value for percentage type
            if (type === 'percentage' && parsedDiscountValue === 100) {
                if (parsedMaxDiscount !== parsedMinOrder) {
                    return res.status(400).json({ success: false, message: "For 100% discount, Max Discount should equal Min Order to cap the discount properly" });
                }
            } else if (parsedMaxDiscount < parsedDiscountValue) {
                return res.status(400).json({ success: false, message: "Max Discount cannot be less than Discount Value" });
            }

            // Update coupon fields
            coupon.title = title.trim();
            coupon.description = description || '';
            coupon.type = type;
            coupon.discountValue = parsedDiscountValue;
            coupon.discountType = discountType.trim();
            coupon.code = code.toUpperCase();
            coupon.minOrder = parsedMinOrder;
            coupon.maxDiscount = parsedMaxDiscount;
            coupon.expireOn = parsedExpireOn;
            coupon.usageLimit = parsedUsageLimit;
            coupon.isPremium = isPremium === true || isPremium === 'true';

            await coupon.save();
            res.status(200).json({ success: true, message: "Coupon updated successfully", coupon });
            console.log(coupon);
        } catch (error) {
            console.error("Error in editCoupon:", error);
            res.status(500).json({ success: false, message: "Server error: " + error.message });
        }
    };

    const deleteCoupon = async (req, res) => {
        try {
            const couponId = req.params.id;
            const coupon = await Coupon.findByIdAndDelete(couponId);
            if (!coupon) {
                return res.status(404).json({ success: false, message: "Coupon not found" });
            }
            res.status(200).json({ success: true, message: "Coupon deleted successfully" });
        } catch (error) {
            console.error("Error in deleteCoupon:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    };

    const toggleCouponStatus = async (req, res) => {
        try {
            const couponId = req.params.id;
            const { isList } = req.body;

            const coupon = await Coupon.findById(couponId);
            if (!coupon) {
                return res.status(404).json({ success: false, message: "Coupon not found" });
            }

            coupon.isList = !isList;
            await coupon.save();
            res.status(200).json({ success: true, message: `Coupon ${isList ? 'unlisted' : 'listed'} successfully` });
        } catch (error) {
            console.error("Error in toggleCouponStatus:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    };
    const applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user ? req.user._id : null;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to apply a coupon" });
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isList: true, expireOn: { $gte: new Date() } });
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found or expired" });
        }

        if (coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        }

        if (coupon.isPremium && !req.user.isPremium) {
            return res.status(403).json({ success: false, message: "This coupon is for premium users only" });
        }

        if (coupon.userId.includes(userId)) {
            return res.status(400).json({ success: false, message: "You have already used this coupon" });
        }

        coupon.usedCount += 1;
        coupon.userId.push(userId);
        await coupon.save();

        res.status(200).json({ success: true, message: "Coupon applied successfully", coupon });
    } catch (error) {
        console.error("Error in applyCoupon:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    loadCouponManagement,
    // loadClientCoupons,
    addCoupon,
    editCoupon,
    deleteCoupon,
    toggleCouponStatus,
    applyCoupon
};

   