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

// Other functions remain as provided
const addCoupon = async (req, res) => {
    try {
        const {
            title, description, type, discountValue, discountType, code,
            minOrder, maxDiscount, expireOn, usageLimit, isPremium
        } = req.body;

        if (!title || !code || !expireOn || !usageLimit) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists" });
        }

        const newCoupon = new Coupon({
            title, description, type, discountValue: Number(discountValue), discountType, code,
            minOrder: Number(minOrder), maxDiscount: Number(maxDiscount), expireOn: new Date(expireOn),
            usageLimit: Number(usageLimit), isPremium: isPremium === "true", isList: true, createdOn: new Date()
        });

        await newCoupon.save();
        res.status(201).json({ success: true, message: "Coupon added successfully" });
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

        if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
            return res.status(400).json({ success: false, message: "Discount value must be a positive number" });
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
        const parsedExpireOn = new Date(expireOn);
        if (isNaN(parsedExpireOn.getTime()) || parsedExpireOn < new Date()) {
            return res.status(400).json({ success: false, message: "Expiration date must be a valid future date" });
        }

        // Check if coupon exists
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        // Check for duplicate coupon code
        const existingCoupon = await Coupon.findOne({ code, _id: { $ne: couponId } });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists" });
        }

        // Update coupon fields
        coupon.title = title;
        coupon.description = description || ''; // Handle empty description
        coupon.type = type;
        coupon.discountValue = parsedDiscountValue;
        coupon.discountType = discountType;
        coupon.code = code.toUpperCase(); // Ensure consistent code format
        coupon.minOrder = parsedMinOrder;
        coupon.maxDiscount = parsedMaxDiscount;
        coupon.expireOn = parsedExpireOn;
        coupon.usageLimit = parsedUsageLimit;
        coupon.isPremium = isPremium === true || isPremium === 'true';

        await coupon.save();
        res.status(200).json({ success: true, message: "Coupon updated successfully" });
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

module.exports = {
    loadCouponManagement,
    addCoupon,
    editCoupon,
    deleteCoupon,
    toggleCouponStatus
};