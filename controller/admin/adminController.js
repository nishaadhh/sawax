const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const pageError = async (req, res) => {
    res.render('admin-error');
}

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin');
    }
    // Ensure errorMessage is null when loading the login page initially
    res.render('admin-login', { errorMessage: null });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ isAdmin: true, email: email });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = admin._id;
                return res.redirect('/admin');
            } else {
                // Render login page with error message for incorrect password
                return res.render('admin-login', { errorMessage: 'Incorrect password. Please try again.' });
            }
        } else {
            // Render login page with error message for invalid email
            return res.render('admin-login', { errorMessage: 'No admin account found with this email.' });
        }
    } catch (error) {
        console.log("Login Error:", error);
        return res.redirect('/pageerror');
    }
};

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            res.render('dashboard');
        } catch (error) {
            console.log("Dashboard Error:", error);
            res.redirect('/pageerror');
        }
    } else {
        return res.redirect('/admin/login');
    }
}

const logout = async (req, res) => {
    try {
        if (req.session.admin) {
            delete req.session.admin;
        }
        res.redirect('/admin/login');
    } catch (error) {
        console.log('Logout Error:', error);
        res.redirect('/pageerror');
    }
};

const getProductManagement = async (req, res) => {
    try {
        const products = await Product.find().populate('category');
        const totalPages = Math.ceil(products.length / 10);
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