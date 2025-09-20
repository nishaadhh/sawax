const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');
const productController = require('../controller/admin/productController');
const bannerController = require("../controller/admin/bannerController");
const orderController = require("../controller/admin/orderController");
const couponController = require('../controller/admin/couponController');
const { adminAuth } = require('../middlewares/auth');
const multer = require("multer");
const upload = multer();
const salesController = require('../controller/admin/salesController');

// Admin Routes
router.get('/pageerror', adminController.pageError);
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);

// DASHBOARD

router.get('/', adminAuth, adminController.loadDashboard);
router.get('/api/sales-data',adminAuth, adminController.getSalesData);
router.get('/api/top-selling',adminAuth, adminController.getTopSelling);


// Customer Routes
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unBlockCustomer', adminAuth, customerController.customerUnblocked);

// Category Routes
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.post('/addCategoryOffer', adminAuth, categoryController.addCategoryOffer);
router.post('/removeCategoryOffer', adminAuth, categoryController.removeCategoryOffer);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unListCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryController.editCategory);
router.post("/editCategoryOffer", adminAuth, categoryController.editCategoryOffer);
router.delete("/deleteCategory/:id", adminAuth, categoryController.deleteCategory);

// Product Routes
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/saveImage", adminAuth, upload.single('image'), productController.saveImage);
router.post("/addProducts", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.addProducts);
router.get("/products", adminAuth, productController.getAllProducts);
router.post("/addProductOffer", adminAuth, productController.addProductOffer);
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer);
router.get("/blockProduct", adminAuth, productController.blockProduct);
router.get("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.editProduct);
router.post("/deleteImage", adminAuth, productController.deleteSingleImage);
router.get("/deleteProduct", adminAuth, productController.deleteProduct);

// Order Management Routes
router.get('/orders', adminAuth, orderController.getOrders);
router.get('/orders/:id', adminAuth, orderController.getOrderDetails);
router.post('/orders/update-status', adminAuth, orderController.updateOrderStatus);
router.post('/orders/cancel', adminAuth, orderController.cancelOrder);
router.post("/orders/handle-return", adminAuth, orderController.handleReturn);
router.post("/orders/update-return-status", adminAuth, orderController.updateReturnStatus);

// Banner Management Routes
router.get("/banner", adminAuth, bannerController.getBannerpage);

// Coupon Management Routes
router.get('/couponManagement', adminAuth, couponController.loadCouponManagement);
router.post('/coupon/add', adminAuth, couponController.addCoupon);
router.put('/coupon/edit/:id', adminAuth, couponController.editCoupon);
router.delete('/coupon/delete/:id', adminAuth, couponController.deleteCoupon);
router.put('/coupon/toggle/:id', adminAuth, couponController.toggleCouponStatus);

// Sales report routes
router.get('/sales-report', adminAuth, salesController.getSalesReport);
router.get('/sales-report/download/excel', adminAuth, salesController.downloadSalesReportExcel);
router.get('/sales-report/download/pdf', adminAuth, salesController.downloadSalesReportPDF);



module.exports = router;