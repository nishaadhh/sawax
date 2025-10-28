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

        // Required fields
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

     
        const parsedDiscountValue = Number(discountValue);
        const parsedUsageLimit = Number(usageLimit);
        const parsedMinOrder = minOrder === null || minOrder === undefined || minOrder === '' ? null : Number(minOrder);
        const parsedMaxDiscount = maxDiscount === null || maxDiscount === undefined || maxDiscount === '' ? null : Number(maxDiscount);

        // Validate discount value
        if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0 || (type === 'percentage' && parsedDiscountValue > 100)) {
            return res.status(400).json({ success: false, message: "Discount value must be a positive number and not exceed 100% for percentage discounts" });
        }

        // Optional

        if (parsedMinOrder !== null) {
            if (isNaN(parsedMinOrder) || parsedMinOrder < 0) {
                return res.status(400).json({ success: false, message: "Minimum order must be a non-negative number" });
            }
        }

        
        if (parsedMaxDiscount !== null) {
            if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
                return res.status(400).json({ success: false, message: "Maximum discount must be a non-negative number" });
            }
        }

        // Valid usage limit
        if (isNaN(parsedUsageLimit) || parsedUsageLimit <= 0) {
            return res.status(400).json({ success: false, message: "Usage limit must be a positive number" });
        }

        // Validate expiration date


        const parsedExpireOn = new Date(expireOn);
        if (isNaN(parsedExpireOn.getTime()) || parsedExpireOn <= new Date()) {
            return res.status(400).json({ success: false, message: "Expiration date must be a valid future date" });
        }

        // Check duplicate code

        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists" });
        }

        // percentage validate 

        if (type === 'percentage' && parsedDiscountValue === 100) {
            if (parsedMaxDiscount !== null && parsedMinOrder !== null && parsedMaxDiscount !== parsedMinOrder) {
                return res.status(400).json({ success: false, message: "For 100% discount, Max Discount should equal Min Order to cap the discount properly" });
            }
        } 
    
        else if (parsedMaxDiscount !== null && parsedMaxDiscount < parsedDiscountValue) {
            return res.status(400).json({ success: false, message: "Max Discount cannot be less than Discount Value" });
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
        console.log("\nCoupon Added successfully");
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

        if (!title || !code || !discountType || !expireOn || !usageLimit) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        
        const parsedDiscountValue = Number(discountValue);
        const parsedUsageLimit = Number(usageLimit);
        const parsedMinOrder = minOrder === null || minOrder === undefined || minOrder === '' ? null : Number(minOrder);
        const parsedMaxDiscount = maxDiscount === null || maxDiscount === undefined || maxDiscount === '' ? null : Number(maxDiscount);

        // Validate discount value
        if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0 || (type === 'percentage' && parsedDiscountValue > 100)) {
            return res.status(400).json({ success: false, message: "Discount value must be a positive number and not exceed 100% for percentage discounts" });
        }

        
        if (parsedMinOrder !== null && (isNaN(parsedMinOrder) || parsedMinOrder < 0)) {
            return res.status(400).json({ success: false, message: "Minimum order must be a non-negative number" });
        }

        
        if (parsedMaxDiscount !== null && (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0)) {
            return res.status(400).json({ success: false, message: "Maximum discount must be a non-negative number" });
        }

        // Validate usage limit
        if (isNaN(parsedUsageLimit) || parsedUsageLimit <= 0) {
            return res.status(400).json({ success: false, message: "Usage limit must be a positive number" });
        }

        // Validate expiration date
        const parsedExpireOn = new Date(expireOn);
        if (isNaN(parsedExpireOn.getTime()) || parsedExpireOn < new Date()) {
            return res.status(400).json({ success: false, message: "Expiration date must be a valid future date" });
        }

        
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase(), _id: { $ne: couponId } });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists" });
        }

        //  validation 100% discount
        if (type === 'percentage' && parsedDiscountValue === 100) {
            if (parsedMaxDiscount !== null && parsedMinOrder !== null && parsedMaxDiscount !== parsedMinOrder) {
                return res.status(400).json({ success: false, message: "For 100% discount, Max Discount should equal Min Order to cap the discount properly" });
            }
        } 
        // maxDiscount < discountValue
        else if (parsedMaxDiscount !== null && parsedMaxDiscount < parsedDiscountValue) {
            return res.status(400).json({ success: false, message: "Max Discount cannot be less than Discount Value" });
        }

        
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
        console.log("\nCoupon updated successfully");
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
        const { newStatus } = req.body; 

        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(400).json({ success: false, message: 'Invalid coupon id' });
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        
        if (typeof newStatus === 'boolean') {
            coupon.isList = newStatus;
        } else {
            coupon.isList = !coupon.isList;
        }

        await coupon.save();

        res.status(200).json({
            success: true,
            message: `Coupon ${coupon.isList ? 'listed' : 'unlisted'} successfully`,
            isList: coupon.isList
        });
    } catch (error) {
        console.error("Error in toggleCouponStatus:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

module.exports = {
    loadCouponManagement,
    addCoupon,
    editCoupon,
    deleteCoupon,
    toggleCouponStatus
};