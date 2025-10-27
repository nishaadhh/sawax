const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");

const loadCoupons = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    // current date
    const currentDate = new Date();

    const coupons = await Coupon.find({
      expireOn: { $gt: currentDate },
      isList: true,
      $or: [
        { isPremium: false },
        { isPremium: true, userId: userId } 
      ]
    }).sort({ createdOn: -1 });

    // Enhance coupons with usage status
    const couponsWithStatus = coupons.map(coupon => {
      const isUsed = coupon.userId.includes(userId);
      return {
        ...coupon.toObject(),
        isUsed: isUsed,
        usageMessage: isUsed ? "Already used, can't use this coupon" : "Available to use"
      };
    });

    res.render("coupon", {
      coupons: couponsWithStatus,
      user: userData,
    });
  } catch (error) {
    console.error("Error in loadCoupons:", error);
    res.redirect("/pageerror");
  }
};

const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { code } = req.body;

    console.log("Applying coupon with code:", code);
    console.log("User ID:", userId);

    // Find coupon with case-insensitive search
    const coupon = await Coupon.findOne({ 
      code: { $regex: new RegExp("^" + code + "$", "i") }, 
      isList: true, 
      expireOn: { $gt: new Date() } 
    });

    console.log("Found coupon:", coupon);

    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: "Coupon not found or expired" 
      });
    }

    // Check if user has already used the coupon
    if (coupon.userId.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Coupon already used" 
      });
    }

    // Check usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ 
        success: false, 
        message: "Coupon usage limit reached" 
      });
    }

    if (coupon.isPremium && !coupon.userId.includes(userId)) {
      return res.status(403).json({ 
        success: false, 
        message: "Premium coupon not available for this user" 
      });
    }








    // Store coupon in session for later use
    req.session.appliedCoupon = {
      _id: coupon._id,
      code: coupon.code,
      discountValue: coupon.discountValue,
      type: coupon.type,
      minOrder: coupon.minOrder,
      maxDiscount: coupon.maxDiscount
    };

    console.log("Coupon stored in session:", req.session.appliedCoupon);

    res.status(200).json({ 
      success: true, 
      message: "Coupon applied successfully",
      coupon: req.session.appliedCoupon
    });
  } catch (error) {
    console.error("Error in applyCoupon:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const getAppliedCoupon = async (req, res) => {
  try {
    if (!req.session.appliedCoupon) {
      return res.status(404).json({ 
        success: false, 
        message: "No coupon applied" 
      });
    }
    
    console.log("Getting applied coupon from session:", req.session.appliedCoupon);
    
    res.status(200).json({ 
      success: true, 
      coupon: req.session.appliedCoupon 
    });
  } catch (error) {
    console.error("Error in getAppliedCoupon:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const removeCoupon = async (req, res) => {
  try {
    if (req.session.appliedCoupon) {
      delete req.session.appliedCoupon;
    }
    res.status(200).json({ 
      success: true, 
      message: "Coupon removed successfully" 
    });
  } catch (error) {
    console.error("Error in removeCoupon:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

//  mark coupon as used 
const markCouponAsUsed = async (couponId, userId) => {
  try {
    const coupon = await Coupon.findById(couponId);
    if (coupon && !coupon.userId.includes(userId)) {
      coupon.usedCount += 1;
      coupon.userId.push(userId);
      await coupon.save();
    }
  } catch (error) {
    console.error("Error marking coupon as used:", error);
  }
};

module.exports = {
  loadCoupons,
  applyCoupon,
  getAppliedCoupon,
  removeCoupon,
  markCouponAsUsed
};