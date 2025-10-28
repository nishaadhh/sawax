const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const path = require("path");
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
  if (req.session.admin) {
    try {
      const productCount = await Product.countDocuments()
      const userCount = await User.countDocuments({ isAdmin: false })
      const orderCount = await Order.countDocuments()

      const orders = await Order.find({ status: "delivered" })
      const totalRevenue = orders.reduce((total, order) => total + order.finalAmount, 0)

      const topProducts = await getTopSellingProducts()

      const recentOrders = await getRecentOrders()

      const salesData = await getSalesDataHelper("monthly")

      const orderStatusCounts = await getOrderStatusCounts()

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
      }

      res.render("dashboard", { dashboardData })
    } catch (error) {
      console.error("Dashboard Error:", error)
      res.redirect("/pageerror")
    }
  } else {
    return res.redirect("/admin/login")
  }
}

const getTopSellingProducts = async (limit = 10) => {
  try {
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
      { $limit: limit },
    ])

 
    const enrichedProducts = await Promise.all(
      topProducts.map(async (product) => {
        const productDetails = await Product.findById(product._id).populate("category")
        // Ensure image path is properly handled (assuming relative paths like '/uploads/image.jpg'; adjust base URL if needed, e.g., process.env.BASE_URL || '')
        const imagePath = productDetails?.productImage?.[0] ? `/uploads/${productDetails.productImage[0]}` : null; // Example fix: prepend '/uploads/' if images are in public/uploads
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

    return enrichedProducts
  } catch (error) {
    console.error("Error getting top products:", error)
    return []
  }
}


const getRecentOrders = async (limit = 5) => {
  try {
    const recentOrders = await Order.find().sort({ createdOn: -1 }).limit(limit)

    
    const ordersWithCustomers = await Promise.all(
      recentOrders.map(async (order) => {
        const customer = await User.findById(order.userId)
        return {
          ...order.toObject(),
          customerName: customer ? `${customer.name} ${customer.email}` : "Unknown",
        }
      }),
    )

    return ordersWithCustomers
  } catch (error) {
    console.error("Error getting recent orders:", error)
    return []
  }
}


const getSalesDataHelper = async (period = "yearly") => {
  try {
    const now = new Date()
    const labels = []
    const data = []

    if (period === "weekly") {
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0) 

        const dayStart = new Date(date)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(date)
        dayEnd.setHours(23, 59, 59, 999)

        const dayOrders = await Order.find({
          createdOn: { $gte: dayStart, $lte: dayEnd },
          status: "delivered",
        })

        const daySales = dayOrders.reduce((total, order) => total + order.finalAmount, 0)

        labels.push(date.toLocaleDateString("en-US", { weekday: "short" }))
        data.push(daySales)
      }
    } else if (period === "monthly") {
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now)
        date.setMonth(date.getMonth() - i)

        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

        const monthOrders = await Order.find({
          createdOn: { $gte: monthStart, $lte: monthEnd },
          status: "delivered",
        })

        const monthSales = monthOrders.reduce((total, order) => total + order.finalAmount, 0)

        labels.push(date.toLocaleDateString("en-US", { month: "short" }))
        data.push(monthSales)
      }
    } else if (period === "yearly") {
      
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i

        const yearStart = new Date(year, 0, 1)
        const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

        const yearOrders = await Order.find({
          createdOn: { $gte: yearStart, $lte: yearEnd },
          status: "delivered",
        })

        const yearSales = yearOrders.reduce((total, order) => total + order.finalAmount, 0)

        labels.push(year.toString())
        data.push(yearSales)
      }
    }

    return { labels, data }
  } catch (error) {
    console.error("Error getting sales data:", error)
    return { labels: [], data: [] }
  }
}


const getOrderStatusCounts = async () => {
  try {
    const statusCounts = {
      Delivered: 0,
      Pending: 0,
      Shipped: 0,
      Cancelled: 0,
      Returned: 0,
    }

    const orders = await Order.find()

    orders.forEach((order) => {
      if (order.status === "delivered") statusCounts["Delivered"]++
      else if (order.status === "pending") statusCounts["Pending"]++
      else if (order.status === "shipped") statusCounts["Shipped"]++
      else if (order.status === "cancelled") statusCounts["Cancelled"]++
      else if (order.status.includes("return")) statusCounts["Returned"]++
    })

    return statusCounts
  } catch (error) {
    console.error("Error getting order status counts:", error)
    return { Delivered: 0, Pending: 0, Shipped: 0, Cancelled: 0, Returned: 0 }
  }
}



const logout = async (req, res) => {
    try {
        if (req.session.admin) {
            delete req.session.admin; 
        }
        res.redirect('/admin/login'); 
    } catch (error) {
        console.log('Logout Error', error);
        res.redirect('/pageerror');
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
        { $match: { "productDetails.category": { $ne: null } } }, 
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

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    getTopSelling,
    getSalesData,
    salesReport
}