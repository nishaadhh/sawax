const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');


const pageError = async (req, res) => {
    res.render('admin-error')
}


const loadLogin = (req, res) => {
    if(req.session.admin){
        return res.redirect('/admin')
    }
    res.render('admin-login',{message:null})
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ isAdmin: true, email: email });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                // ✅ Store the admin's ObjectId instead of true
                req.session.admin = admin._id;
                return res.redirect('/admin');
            } else {
                return res.redirect('/admin/login');
            }
        } else {
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.log("Login Error", error);
        return res.redirect('/pageerror');
    }
};


const loadDashboard = async (req, res) => {
    if(req.session.admin){
        try {
            res.render('dashboard')
        } catch (error) {
            res.redirect('/pageerror')
        }
    } else{
        return res.redirect('/admin/login')
    }
}


const logout = async (req, res) => {
    try {
        if (req.session.admin) {
            delete req.session.admin; //  Remove only admin session
        }
        res.redirect('/admin/login'); // Redirect admin to login page
    } catch (error) {
        console.log('Logout Error', error);
        res.redirect('/pageerror');
    }
};

// In adminController.js
const getProductManagement = async (req, res) => {
  try {
    const products = await Product.find().populate('category');
    const totalPages = Math.ceil(products.length / 10); // Adjust pagination
    res.render('product-management', {
      data: products,
      totalPages,
      currentPage: parseInt(req.query.page) || 1,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Server error');
  }
};




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    getProductManagement

}