const mongoose = require('mongoose');
const Order = require("../../models/orderSchema");
const moment = require('moment');
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const path = require('path');

const getSalesReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      period = 'all',
      page = 1,
      limit = 10 
    } = req.query;

    let dateFilter = {};
    let reportTitle = 'Sales Report';
    let fromDate, toDate;

    
    if (period === 'today') {
      fromDate = moment().startOf('day');
      toDate = moment().endOf('day');
      reportTitle = 'Daily Sales Report';
    } else if (period === 'week') {
      fromDate = moment().startOf('week');
      toDate = moment().endOf('week');
      reportTitle = 'Weekly Sales Report';
    } else if (period === 'month') {
      fromDate = moment().startOf('month');
      toDate = moment().endOf('month');
      reportTitle = 'Monthly Sales Report';
    } else if (period === 'year') {
      fromDate = moment().startOf('year');
      toDate = moment().endOf('year');
      reportTitle = 'Yearly Sales Report';
    } else if (period === 'custom' && startDate && endDate) {
      fromDate = moment(startDate).startOf('day');
      toDate = moment(endDate).endOf('day');
      reportTitle = `Custom Sales Report (${fromDate.format('DD/MM/YYYY')} - ${toDate.format('DD/MM/YYYY')})`;
    }

    // Apply date filter if dates are set
    if (fromDate && toDate) {
      dateFilter.createdOn = {
        $gte: fromDate.toDate(),
        $lte: toDate.toDate()
      };
    }

    
    const baseQuery = {
      status: { $in: ['delivered', 'returned'] },
      paymentStatus: 'completed',
      ...dateFilter
    };

    // Get total pagination
    const totalOrders = await Order.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalOrders / limit);
    const skip = (page - 1) * limit;

    // Get orders with pagination
    const orders = await Order.find(baseQuery)
      .populate({
        path: 'userId',
        select: 'name email'
      })
      .populate({
        path: 'orderedItems.product',
        select: 'productName brand category'
      })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate 
    const summaryPipeline = [
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalDiscount: { $sum: '$discount' },
          totalDeliveryCharges: { $sum: '$deliveryCharge' },
          totalGrossAmount: { $sum: '$totalPrice' },
          averageOrderValue: { $avg: '$finalAmount' },
          codOrders: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'cod'] }, 1, 0] }
          },
          onlineOrders: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'online'] }, 1, 0] }
          },
          walletOrders: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'wallet'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          returnedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] }
          },
          totalRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'returned'] }, '$finalAmount', 0] }
          }
        }
      }
    ];

    const summaryResult = await Order.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      totalDeliveryCharges: 0,
      totalGrossAmount: 0,
      averageOrderValue: 0,
      codOrders: 0,
      onlineOrders: 0,
      walletOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      totalRefunds: 0
    };

    // top selling products
    const topProductsPipeline = [
      { $match: baseQuery },
      { $unwind: '$orderedItems' },
      {
        $group: {
          _id: '$orderedItems.product',
          productName: { $first: '$orderedItems.productName' },
          totalQuantity: { $sum: '$orderedItems.quantity' },
          totalRevenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ];

    const topProducts = await Order.aggregate(topProductsPipeline);

    // Get daily sales data for chart - last 30 days
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

    const filterParams = {
      startDate,
      endDate,
      period,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    res.render('admin-sales-report', {
      title: reportTitle,
      orders,
      summary,
      topProducts,
      chartData,
      currentPage: parseInt(page),
      totalPages,
      totalOrders,
      filterParams,
      moment,
      reportTitle
    });

  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).render('admin-sales-report', {
      title: 'Sales Report',
      orders: [],
      summary: {},
      topProducts: [],
      chartData: [],
      currentPage: 1,
      totalPages: 1,
      totalOrders: 0,
      filterParams: {},
      moment,
      reportTitle: 'Sales Report',
      error: 'Failed to generate sales report'
    });
  }
};

const downloadSalesReportExcel = async (req, res) => {
  try {
    const { startDate, endDate, period = 'all' } = req.query;
    
    let dateFilter = {};
    let reportTitle = 'Sales Report';
    let fromDate, toDate;

    
    if (period === 'today') {
      fromDate = moment().startOf('day');
      toDate = moment().endOf('day');
      reportTitle = 'Daily Sales Report';
    } else if (period === 'week') {
      fromDate = moment().startOf('week');
      toDate = moment().endOf('week');
      reportTitle = 'Weekly Sales Report';
    } else if (period === 'month') {
      fromDate = moment().startOf('month');
      toDate = moment().endOf('month');
      reportTitle = 'Monthly Sales Report';
    } else if (period === 'year') {
      fromDate = moment().startOf('year');
      toDate = moment().endOf('year');
      reportTitle = 'Yearly Sales Report';
    } else if (period === 'custom' && startDate && endDate) {
      fromDate = moment(startDate).startOf('day');
      toDate = moment(endDate).endOf('day');
      reportTitle = `Custom Sales Report (${fromDate.format('DD/MM/YYYY')} - ${toDate.format('DD/MM/YYYY')})`;
    }

    if (fromDate && toDate) {
      dateFilter.createdOn = {
        $gte: fromDate.toDate(),
        $lte: toDate.toDate()
      };
    }

    const baseQuery = {
      status: { $in: ['delivered', 'returned'] },
      paymentStatus: 'completed',
      ...dateFilter
    };

    // Get all orders for Excel export
    const orders = await Order.find(baseQuery)
      .populate({
        path: 'userId',
        select: 'name email'
      })
      .populate({
        path: 'orderedItems.product',
        select: 'productName brand'
      })
      .sort({ createdOn: -1 });

    // Calculate summary
    const summaryPipeline = [
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalDiscount: { $sum: '$discount' },
          totalDeliveryCharges: { $sum: '$deliveryCharge' },
          totalGrossAmount: { $sum: '$totalPrice' },
          averageOrderValue: { $avg: '$finalAmount' },
          totalRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'returned'] }, '$finalAmount', 0] }
          }
        }
      }
    ];

    const summaryResult = await Order.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {};

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Set column headers
    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Products', key: 'products', width: 30 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Gross Amount', key: 'grossAmount', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Delivery Charge', key: 'deliveryCharge', width: 15 },
      { header: 'Final Amount', key: 'finalAmount', width: 12 }
    ];

    // Add title row
    worksheet.insertRow(1, [reportTitle]);
    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Add summary row
    const summaryRow = worksheet.insertRow(2, [
      'Summary:',
      `Total Orders: ${summary.totalOrders || 0}`,
      `Total Revenue: ₹${(summary.totalRevenue || 0).toFixed(2)}`,
      `Total Discount: ₹${(summary.totalDiscount || 0).toFixed(2)}`,
      `Average Order Value: ₹${(summary.averageOrderValue || 0).toFixed(2)}`
    ]);
    worksheet.mergeCells('A2:K2');
    summaryRow.font = { bold: true };

    // Add empty row
    worksheet.addRow([]);

    // Style header row
    const headerRow = worksheet.getRow(4);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    orders.forEach(order => {
      const productNames = order.orderedItems.map(item => item.productName).join(', ');
      
      worksheet.addRow({
        orderId: order.orderId,
        date: moment(order.createdOn).format('DD/MM/YYYY'),
        customer: order.userId?.name || 'N/A',
        email: order.userId?.email || 'N/A',
        products: productNames,
        paymentMethod: order.paymentMethod.toUpperCase(),
        status: order.status.toUpperCase(),
        grossAmount: order.totalPrice,
        discount: order.discount,
        deliveryCharge: order.deliveryCharge,
        finalAmount: order.finalAmount
      });
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reportTitle.replace(/\s+/g, '_')}_${moment().format('DD_MM_YYYY')}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel report' });
  }
};

const downloadSalesReportPDF = async (req, res) => {
  try {
    const { startDate, endDate, period = 'all' } = req.query;
    
    let dateFilter = {};
    let reportTitle = 'Sales Report';
    let fromDate, toDate;

    
    if (period === 'today') {
      fromDate = moment().startOf('day');
      toDate = moment().endOf('day');
      reportTitle = 'Daily Sales Report';
    } else if (period === 'week') {
      fromDate = moment().startOf('week');
      toDate = moment().endOf('week');
      reportTitle = 'Weekly Sales Report';
    } else if (period === 'month') {
      fromDate = moment().startOf('month');
      toDate = moment().endOf('month');
      reportTitle = 'Monthly Sales Report';
    } else if (period === 'year') {
      fromDate = moment().startOf('year');
      toDate = moment().endOf('year');
      reportTitle = 'Yearly Sales Report';
    } else if (period === 'custom' && startDate && endDate) {
      fromDate = moment(startDate).startOf('day');
      toDate = moment(endDate).endOf('day');
      reportTitle = `Custom Sales Report (${fromDate.format('DD/MM/YYYY')} - ${toDate.format('DD/MM/YYYY')})`;
    }

    if (fromDate && toDate) {
      dateFilter.createdOn = {
        $gte: fromDate.toDate(),
        $lte: toDate.toDate()
      };
    }

    const baseQuery = {
      status: { $in: ['delivered', 'returned'] },
      paymentStatus: 'completed',
      ...dateFilter
    };

    // Get orders and summary for PDF
    const orders = await Order.find(baseQuery)
      .populate({
        path: 'userId',
        select: 'name email'
      })
      .populate({
        path: 'orderedItems.product',
        select: 'productName brand'
      })
      .sort({ createdOn: -1 })
      .limit(100);

    const summaryPipeline = [
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalDiscount: { $sum: '$discount' },
          totalDeliveryCharges: { $sum: '$deliveryCharge' },
          totalGrossAmount: { $sum: '$totalPrice' },
          averageOrderValue: { $avg: '$finalAmount' },
          totalRefunds: {
            $sum: { $cond: [{ $eq: ['$status', 'returned'] }, '$finalAmount', 0] }
          }
        }
      }
    ];

    const summaryResult = await Order.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {};

    // PENDING : puppter is for Generating HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #333; margin-bottom: 10px; }
          .header p { color: #666; }
          .summary { background: #f8f9fa; padding: 20px; margin-bottom: 30px; border-radius: 8px; }
          .summary h2 { margin-top: 0; color: #333; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
          .summary-item { background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
          .summary-item h3 { margin: 0 0 5px 0; color: #333; font-size: 14px; }
          .summary-item p { margin: 0; font-size: 18px; font-weight: bold; color: #007bff; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f8f9fa; font-weight: bold; }
          .status { padding: 3px 8px; border-radius: 3px; font-size: 10px; text-transform: uppercase; }
          .status.delivered { background: #d4edda; color: #155724; }
          .status.returned { background: #f8d7da; color: #721c24; }
          .amount { text-align: right; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${reportTitle}</h1>
          <p>Generated on ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
          ${fromDate && toDate ? `<p>Period: ${fromDate.format('DD/MM/YYYY')} - ${toDate.format('DD/MM/YYYY')}</p>` : ''}
        </div>

        <div class="summary">
          <h2>Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <h3>Total Orders</h3>
              <p>${summary.totalOrders || 0}</p>
            </div>
            <div class="summary-item">
              <h3>Total Revenue</h3>
              <p>₹${(summary.totalRevenue || 0).toFixed(2)}</p>
            </div>
            <div class="summary-item">
              <h3>Total Discount</h3>
              <p>₹${(summary.totalDiscount || 0).toFixed(2)}</p>
            </div>
            <div class="summary-item">
              <h3>Average Order Value</h3>
              <p>₹${(summary.averageOrderValue || 0).toFixed(2)}</p>
            </div>
            <div class="summary-item">
              <h3>Total Refunds</h3>
              <p>₹${(summary.totalRefunds || 0).toFixed(2)}</p>
            </div>
            <div class="summary-item">
              <h3>Net Revenue</h3>
              <p>₹${((summary.totalRevenue || 0) - (summary.totalRefunds || 0)).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <h2>Order Details</h2>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Products</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Gross Amount</th>
              <th>Discount</th>
              <th>Final Amount</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(order => `
              <tr>
                <td>${order.orderId}</td>
                <td>${moment(order.createdOn).format('DD/MM/YYYY')}</td>
                <td>${order.userId?.name || 'N/A'}</td>
                <td>${order.orderedItems.map(item => item.productName).join(', ')}</td>
                <td>${order.paymentMethod.toUpperCase()}</td>
                <td><span class="status ${order.status}">${order.status.toUpperCase()}</span></td>
                <td class="amount">₹${order.totalPrice.toFixed(2)}</td>
                <td class="amount">₹${order.discount.toFixed(2)}</td>
                <td class="amount">₹${order.finalAmount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report contains ${orders.length} orders${orders.length >= 100 ? ' (limited to 100 for PDF)' : ''}</p>
          <p>Generated by Admin Panel - Sales Report System</p>
        </div>
      </body>
      </html>
    `;

    // Launch puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportTitle.replace(/\s+/g, '_')}_${moment().format('DD_MM_YYYY')}.pdf"`);

    res.send(pdf);

  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF report' });
  }
};

module.exports = {
  getSalesReport,
  downloadSalesReportExcel,
  downloadSalesReportPDF
};