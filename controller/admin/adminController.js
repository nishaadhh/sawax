const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const moment = require('moment');

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
      // Fetch total users
      const totalUsers = await User.countDocuments({ isAdmin: false });

      // Fetch total orders
      const totalOrders = await Order.countDocuments({
        status: { $in: ['delivered', 'returned'] },
        paymentStatus: 'completed'
      });

      // Fetch total revenue, refunds, and other summary stats
      const summaryPipeline = [
        {
          $match: {
            status: { $in: ['delivered', 'returned'] },
            paymentStatus: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalAmount' },
            totalRefunds: {
              $sum: { $cond: [{ $eq: ['$status', 'returned'] }, '$finalAmount', 0] }
            }
          }
        }
      ];
      const summaryResult = await Order.aggregate(summaryPipeline);
      const summary = summaryResult[0] || { totalRevenue: 0, totalRefunds: 0 };

      // Fetch total products
      const totalProducts = await Product.countDocuments();

      // Fetch top products (bestsellers)
      const topProductsPipeline = [
        {
          $match: {
            status: { $in: ['delivered', 'returned'] },
            paymentStatus: 'completed'
          }
        },
        { $unwind: '$orderedItems' },
        {
          $group: {
            _id: '$orderedItems.product',
            productName: { $first: '$orderedItems.productName' },
            brand: { $first: '$orderedItems.product.brand' },
            category: { $first: '$orderedItems.product.category' },
            productImage: { $first: '$orderedItems.productImages' },
            totalQuantity: { $sum: '$orderedItems.quantity' }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        { $unwind: '$productDetails' },
        {
          $lookup: {
            from: 'categories',
            localField: 'productDetails.category',
            foreignField: '_id',
            as: 'categoryDetails'
          }
        },
        { $unwind: '$categoryDetails' },
        {
          $project: {
            productName: 1,
            brand: '$productDetails.brand',
            category: '$categoryDetails',
            productImage: '$productDetails.productImage',
            totalQuantity: 1
          }
        }
      ];
      const topProducts = await Order.aggregate(topProductsPipeline);

      // Fetch chart data (last 30 days)
      const chartDataPipeline = [
        {
          $match: {
            status: { $in: ['delivered', 'returned'] },
            paymentStatus: 'completed',
            createdOn: {
              $gte: moment().subtract(30, 'days').startOf('day').toDate(),
              $lte: moment().endOf('day').toDate()
            }
          }
        },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$createdOn' } }
            },
            dailyRevenue: { $sum: '$finalAmount' },
            dailyOrders: { $sum: 1 }
          }
        },
        { $sort: { '_id.day': 1 } }
      ];
      const chartData = await Order.aggregate(chartDataPipeline);

      // Fetch recent orders (last 7 days)
      const recentOrders = await Order.find({
        status: { $in: ['delivered', 'returned', 'pending', 'confirmed', 'shipped'] },
        createdOn: {
          $gte: moment().subtract(7, 'days').startOf('day').toDate()
        }
      })
        .populate({
          path: 'userId',
          select: 'name'
        })
        .sort({ createdOn: -1 })
        .limit(5);

      // Render dashboard with all data, including error: null
      res.render('dashboard', {
        totalUsers,
        totalOrders,
        totalRevenue: summary.totalRevenue,
        totalRefunds: summary.totalRefunds,
        totalProducts,
        topProducts,
        chartData,
        recentOrders,
        moment,
        error: null // Explicitly set error to null on success
      });
    } catch (error) {
      console.error('Dashboard Error:', error);
      res.render('dashboard', {
        totalUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalRefunds: 0,
        totalProducts: 0,
        topProducts: [],
        chartData: [],
        recentOrders: [],
        moment,
        error: 'Failed to load dashboard data'
      });
    }
  } else {
    return res.redirect('/admin/login');
  }
};

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