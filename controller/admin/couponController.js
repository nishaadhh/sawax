const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")


const loadCoupon = async (req,res) => {
    try {

        const findCoupons = await Coupon.find({})
        

        return res.render("couponManagement",{coupons:findCoupons})

    } catch (error) {
        return res.redirect("/pageerror")
        
    }
}

const createCoupon = async (req,res) => {
    try {
        
        
    const data = {
        couponName:req.body.couponName,
        startDate: new Date(req.body.startDate + "T00:00:00"),
        endDate: new Date(req.body.endDate + "T00:00:00"),
        offerPrice: parseInt(req.body.offerPrice),
        minimumPrice: parseInt(req.body.minimumPrice),
    }

    const newCoupon = new Coupon({
        name:data.couponName,
        createdOn: data.startDate,
        expireOn: data.endDate,
        offerPrice: data.offerPrice,
        minimumPrice: data.minimumPrice
    })

    await newCoupon.save()

    return res.redirect("/admin/couponManagement");


    } catch (error) {

        res.redirect("/pageerror")
        
    }
}

const editCoupon = async (req,res) => {
    try {

        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id});

        res.render("editCoupon", { findCoupon });

        
        
    } catch (error) {

        res.redirect("/pageerror")
        
    }
}

const updateCoupon = async (req, res) => {
    try {
        const couponId = req.query.couponId;
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            return res.redirect("/pageerror"); // redirect instead of JSON
        }

        const selectedCoupon = await Coupon.findById(couponId);
        if (!selectedCoupon) {
            return res.redirect("/pageerror");
        }

        const startDate = new Date(req.body.startDate + "T00:00:00");
        const endDate = new Date(req.body.endDate + "T00:00:00");

        await Coupon.findByIdAndUpdate(couponId, {
            name: req.body.couponName,
            createdOn: startDate,
            expireOn: endDate,
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice)
        });

        // Redirect to the coupon list page
        return res.redirect("/admin/couponManagement");

    } catch (error) {
        console.error("Error updating coupon:", error);
        return res.redirect("/pageerror");
    }
};


const deleteCoupon = async (req,res) => {
    try {
        
        const id = req.query.id;
        await Coupon.deleteOne({_id:id})
        res.status(200).send({success:true,message:"Coupon deleted successfully"})

    } catch (error) {
        console.error("Error Deleting Coupon",error)
        res.status(500).send({success:false,message:"Internal Server Error"})
    }
}


module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon,


}