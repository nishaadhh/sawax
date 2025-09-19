




















const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Transaction = require('../../models/transactionSchema');
const csvStringify = require('csv-stringify'); // Add this dependency
const { Readable } = require('stream');

const pageError = async (req, res) => {
    res.render('admin-error');
};

const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin');
    }
    res.render('admin-login', { message: null });
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ isAdmin: true, email }).lean(); // Use lean for performance

        if (!admin) {
            return res.redirect('/admin/login');
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (passwordMatch) {
            req.session.admin = admin._id;
            return res.redirect('/admin');
        } else {
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.error('Login Error:', error);
        return res.redirect('/pageerror');
    }
};

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            const adminId = req.session.admin;
            const admin = await User.findById(adminId).select('isAdmin').lean();
            if (!admin || !admin.isAdmin) {
                return res.redirect('/admin/login');
            }

            const productCount = await Product.countDocuments();
            const userCount = await User.countDocuments({ isAdmin: false });
            const orderCount = await Order.countDocuments();
            const orders = await Order.find({ status: 'delivered' });
            const totalRevenue = orders.reduce((total, order) => total + order.finalAmount, 0);
            const topProducts = await getTopSellingProducts();
            const recentOrders = await getRecentOrders();
            const salesData = await getSalesDataHelper('monthly');
            const orderStatusCounts = await getOrderStatusCounts();

            const dashboardData = {
                productCount,
                userCount,
                orderCount,
                totalRevenue,
                topProducts,
                recentOrders,
                salesData: salesData.data,
                salesLabels: salesData.labels,
                orderStatusData: Object.values(orderStatusCounts),
                orderStatusLabels: Object.keys(orderStatusCounts),
            };

            res.render('dashboard', { dashboardData, request: req });
        } catch (error) {
            console.error('Dashboard Error:', error);
            res.redirect('/pageerror');
        }
    } else {
        return res.redirect('/admin/login');
    }
};






const getTopSelling = async (req, res) => {
  try {
    const { type } = req.query

    if (type === "categories") {
      
      const topCategories = await Order.aggregate([
        { $match: { status: "delivered" } },
        { $unwind: "$orderedItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        { $match: { "productDetails.category": { $ne: null } } }, // Fix: Skip products without category to avoid lookup errors
        {
          $lookup: {
            from: "categories",
            localField: "productDetails.category",
            foreignField: "_id",
            as: "categoryDetails",
          },
        },
        { $unwind: "$categoryDetails" },
        {
          $group: {
            _id: "$categoryDetails._id",
            name: { $first: "$categoryDetails.name" },
            productCount: { $addToSet: "$productDetails._id" },
            soldCount: { $sum: "$orderedItems.quantity" },
            totalSales: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            productCount: { $size: "$productCount" },
            soldCount: 1,
            totalSales: 1,
          },
        },
        { $sort: { soldCount: -1 } },
        { $limit: 10 },
      ])

      res.json({ categories: topCategories })
    } else {
     
      const topProducts = await Order.aggregate([
        { $match: { status: "delivered" } },
        { $unwind: "$orderedItems" },
        {
          $group: {
            _id: "$orderedItems.product",
            name: { $first: "$orderedItems.productName" },
            soldCount: { $sum: "$orderedItems.quantity" },
            totalSales: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
          },
        },
        { $sort: { soldCount: -1 } },
        { $limit: 10 },
      ])

     
      const enrichedProducts = await Promise.all(
        topProducts.map(async (product) => {
          const productDetails = await Product.findById(product._id).populate("category")
          // Same fix for image path as in getTopSellingProducts
          const imagePath = productDetails?.productImage?.[0] ? `/uploads/${productDetails.productImage[0]}` : null;
          return {
            _id: product._id,
            name: product.name,
            category: productDetails?.category?.name || "Uncategorized",
            price: productDetails?.salePrice || 0,
            image: imagePath,
            soldCount: product.soldCount,
          }
        }),
      )

      res.json({ products: enrichedProducts })
    }
  } catch (error) {
    console.error("Error in getTopSelling API:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

const getSalesData = async (req, res) => {
  try {
    const { period = "monthly" } = req.query

    const salesData = await getSalesDataHelper(period)
    res.json(salesData)
  } catch (error) {
    console.error("Error in getSalesData API:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

const salesReport = async (req, res) => {
  try {
    const orders = await Order.find({ status: "delivered" }).sort({ createdOn: -1 }).populate('userId', 'name email');
    
    let csv = 'Order ID,Customer Name,Date,Amount,Items Count\n';
    orders.forEach(order => {
      const customerName = order.userId ? `${order.userId.name || 'N/A'} (${order.userId.email || ''})` : 'Unknown';
      csv += `"${order.orderId}","${customerName}","${order.createdOn.toLocaleDateString()}","${order.finalAmount}","${order.orderedItems.length}"\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename=sales-report.csv');
    res.send(csv);
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.redirect('/pageerror');
  }
}







// [Existing getTopSellingProducts, getRecentOrders, getSalesDataHelper, getOrderStatusCounts remain unchanged]

const logout = async (req, res) => {
    try {
        if (req.session.admin) {
            delete req.session.admin;
        }
        res.redirect('/admin/login');
    } catch (error) {
        console.error('Logout Error:', error);
        res.redirect('/pageerror');
    }
};

// [Existing getTopSelling, getSalesData, salesReport remain unchanged]

const loadTransactions = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        const adminId = req.session.admin;
        const admin = await User.findById(adminId).select('isAdmin').lean();
        if (!admin || !admin.isAdmin) {
            return res.status(403).render('admin-error', { message: 'Unauthorized access' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const { userSearch, fromDate, toDate, type, purpose, status } = req.query;

        // Validate and sanitize inputs
        const sanitizedUserSearch = userSearch ? userSearch.trim() : '';
        const sanitizedFromDate = fromDate ? new Date(fromDate) : null;
        const sanitizedToDate = toDate ? new Date(toDate) : null;
        if (sanitizedFromDate && isNaN(sanitizedFromDate)) sanitizedFromDate = null;
        if (sanitizedToDate && isNaN(sanitizedToDate)) sanitizedToDate = null;
        const validTypes = ['credit', 'debit'];
        const validPurposes = ['purchase', 'refund', 'cancellation', 'return', 'wallet_add', 'wallet_withdraw'];
        const validStatuses = ['completed', 'pending', 'failed', 'refunded'];

        const query = {};
        if (sanitizedUserSearch) {
            const users = await User.find({
                $or: [
                    { name: { $regex: sanitizedUserSearch, $options: 'i' } },
                    { email: { $regex: sanitizedUserSearch, $options: 'i' } }
                ]
            }).select('_id');
            query.userId = users.length > 0 ? { $in: users.map(u => u._id) } : null;
        }
        if (sanitizedFromDate) query.createdAt = { ...query.createdAt, $gte: sanitizedFromDate };
        if (sanitizedToDate) query.createdAt = { ...query.createdAt, $lte: sanitizedToDate };
        if (type && validTypes.includes(type)) query.transactionType = type;
        if (purpose && validPurposes.includes(purpose)) query.purpose = purpose;
        if (status && validStatuses.includes(status)) query.status = status;

        const transactions = await Transaction.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(); // Use lean for performance

        const aggregates = await Transaction.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalCredits: { $sum: { $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0] } },
                    totalDebits: { $sum: { $cond: [{ $eq: ['$transactionType', 'debit'] }, '$amount', 0] } },
                    count: { $sum: 1 }
                }
            }
        ]);
        const totals = aggregates[0] || { totalCredits: 0, totalDebits: 0, count: 0 };
        totals.net = totals.totalCredits - totals.totalDebits;

        const pages = Math.ceil(totals.count / limit);

        res.render('transactionHistory', {
            transactions,
            totals,
            currentPage: page,
            pages,
            filters: req.query,
            request: req
        });
    } catch (error) {
        console.error('Transaction History Error:', error);
        res.redirect('/pageerror');
    }
};

// Download Transactions as CSV
const downloadTransactionsCSV = async (req, res) => {
    if (!req.session.admin) {
        return res.status(403).redirect('/admin/login');
    }

    try {
        const adminId = req.session.admin;
        const admin = await User.findById(adminId).select('isAdmin').lean();
        if (!admin || !admin.isAdmin) {
            return res.status(403).render('admin-error', { message: 'Unauthorized access' });
        }

        const { userSearch, fromDate, toDate, type, purpose, status } = req.query;
        const sanitizedUserSearch = userSearch ? userSearch.trim() : '';
        const sanitizedFromDate = fromDate ? new Date(fromDate) : null;
        const sanitizedToDate = toDate ? new Date(toDate) : null;
        if (sanitizedFromDate && isNaN(sanitizedFromDate)) sanitizedFromDate = null;
        if (sanitizedToDate && isNaN(sanitizedToDate)) sanitizedToDate = null;
        const validTypes = ['credit', 'debit'];
        const validPurposes = ['purchase', 'refund', 'cancellation', 'return', 'wallet_add', 'wallet_withdraw'];
        const validStatuses = ['completed', 'pending', 'failed', 'refunded'];

        const query = {};
        if (sanitizedUserSearch) {
            const users = await User.find({
                $or: [
                    { name: { $regex: sanitizedUserSearch, $options: 'i' } },
                    { email: { $regex: sanitizedUserSearch, $options: 'i' } }
                ]
            }).select('_id');
            query.userId = users.length > 0 ? { $in: users.map(u => u._id) } : null;
        }
        if (sanitizedFromDate) query.createdAt = { ...query.createdAt, $gte: sanitizedFromDate };
        if (sanitizedToDate) query.createdAt = { ...query.createdAt, $lte: sanitizedToDate };
        if (type && validTypes.includes(type)) query.transactionType = type;
        if (purpose && validPurposes.includes(purpose)) query.purpose = purpose;
        if (status && validStatuses.includes(status)) query.status = status;

        const transactions = await Transaction.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        const csvData = [['Transaction ID', 'User Name', 'User Email', 'Amount', 'Type', 'Purpose', 'Status', 'Date', 'Description']];
        transactions.forEach(tx => {
            csvData.push([
                tx.transactionId,
                tx.userId?.name || 'N/A',
                tx.userId?.email || 'N/A',
                tx.amount,
                tx.transactionType,
                tx.purpose,
                tx.status,
                tx.createdAt.toLocaleString(),
                tx.description
            ]);
        });

        csvStringify(csvData, { header: false }, (err, output) => {
            if (err) {
                console.error('CSV Stringify Error:', err);
                return res.redirect('/pageerror');
            }
            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', 'attachment; filename=transaction-history.csv');
            res.send(output);
        });
    } catch (error) {
        console.error('CSV Download Error:', error);
        res.redirect('/pageerror');
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    getTopSelling,
    getSalesData,
    salesReport,
    loadTransactions,
    downloadTransactionsCSV,
};
// ==========================================================           =============