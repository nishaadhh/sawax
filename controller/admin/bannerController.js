const Banner = require("../../models/BannerSchema");
const path = require("path");
const fs = require("fs");




const getBannerpages = async (req , res ) =>{
  try {
    const findBanner = await Banner.find({});
    res.render("banner",{data:findBanner})
  }catch (error) {
    res.redirect("/pageerror")
  }
}
const getBannerpage = async (req , res ) =>{
  try {
    const findBanner = await Banner.find({});
    res.render("banner",{data:findBanner})
  }catch (error) {
    res.redirect("/pageerror")
  }
}


module.exports = {
  getBannerpage
}


