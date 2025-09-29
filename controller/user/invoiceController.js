const { generateInvoicePDF } = require('../../utils/invoiceGenerator');
const Order = require('../../models/orderSchema'); 



const generateInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user;
    
    const order = await Order.findOne({ 
      $or: [
        { _id: orderId, userId },
        { orderId: orderId, userId }
      ]
    }).populate('orderedItems.product');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.status !== 'delivered') {
      return res.status(400).send('Invoice can only be generated for delivered orders');
    }

    // Generate and send PDF invoice
    generateInvoicePDF(order, res);
    
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};

module.exports = {
  generateInvoice
};