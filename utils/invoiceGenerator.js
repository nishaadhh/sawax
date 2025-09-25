const PDFDocument = require('pdfkit');

function generateInvoicePDF(order, res) {
  // Create a new PDF document
  const doc = new PDFDocument({ margin: 50 });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
  
  // Pipe the PDF to the response
  doc.pipe(res);
  
  // Add header
  doc.fontSize(20)
     .text('INVOICE', { align: 'center' })
     .moveDown();
  
  // Add company info (you can customize this)
  doc.fontSize(12)
     .text('SAWAX', { align: 'left' })
     .text('Time City')
     .text('Phone: 04931 783483')
     .text('Email: sawaxwatches@gmail.com')
     .moveDown();
  
  // Add invoice details
  doc.fontSize(14)
     .text(`Invoice #: ${order.orderId}`)
     .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`)
     .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`)
     .moveDown();
  
  // Add customer info with better line handling to avoid mangling
  if (order.address) {
    doc.fontSize(12)
       .text('Bill To:', { underline: true })
       .moveDown(0.5);
    
    const addressLines = [];
    if (order.address.fullName) addressLines.push(order.address.fullName);
    const streetParts = [order.address.houseName, order.address.area, order.address.landmark].filter(Boolean).join(', ');
    if (streetParts) addressLines.push(streetParts);
    const cityParts = [order.address.city, `${order.address.state} ${order.address.pincode}`].filter(Boolean).join(', ');
    if (cityParts) addressLines.push(cityParts);
    if (order.address.phone) addressLines.push(`Phone: ${order.address.phone}`);
    
    addressLines.forEach((line, index) => {
      doc.text(line);
      if (index < addressLines.length - 1) doc.moveDown(0.2); // Tight spacing for address
    });
    doc.moveDown();
  } else {
    doc.text('Bill To: Address not provided');
    doc.moveDown();
  }
  
  // Add table header
  const startX = 50;
  let currentY = doc.y + 10; // Slight offset
  
  doc.fontSize(10).font('Helvetica-Bold') // Smaller font for table to fit better
     .text('Item', startX, currentY, { width: 200, continued: false })
     .text('Qty', startX + 200, currentY, { width: 50, continued: false })
     .text('Price', startX + 250, currentY, { width: 80, continued: false })
     .text('Total', startX + 330, currentY, { width: 80 });
  
  // Draw line under header
  currentY += 15;
  doc.moveTo(startX, currentY).lineTo(startX + 410, currentY).stroke();
  currentY += 5;
  
  // Add ordered items with formatted prices (Indian locale for commas, fixes potential rendering issues)
  let subtotal = 0;
  doc.fontSize(9).font('Helvetica'); // Standard font for items
  order.orderedItems.forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    
    doc.text(item.product?.productName || 'Product', startX, currentY, { width: 200 })
       .text(item.quantity.toString(), startX + 200, currentY, { width: 50 })
       .text(`₹${item.price.toLocaleString('en-IN')}`, startX + 250, currentY, { width: 80 })
       .text(`₹${itemTotal.toLocaleString('en-IN')}`, startX + 330, currentY, { width: 80 });
    
    currentY += 15; // Tighter row spacing
  });
  
  // Line before totals
  currentY += 10;
  doc.moveTo(startX + 250, currentY).lineTo(startX + 410, currentY).stroke();
  currentY += 15;
  
  // Add totals with proper spacing and formatting
  doc.fontSize(10).font('Helvetica');
  doc.text('Subtotal:', startX + 250, currentY);
  doc.text(`₹${subtotal.toLocaleString('en-IN')}`, startX + 330, currentY);
  currentY += 20;
  
  let totalDiscount = 0;
  if (order.discount && order.discount > 0) {
    doc.text('Discount:', startX + 250, currentY);
    doc.text(`-₹${order.discount.toLocaleString('en-IN')}`, startX + 330, currentY);
    totalDiscount += order.discount;
    currentY += 15;
  }
  
  if (order.couponDiscount && order.couponDiscount > 0) {
    doc.text('Coupon Discount:', startX + 250, currentY);
    doc.text(`-₹${order.couponDiscount.toLocaleString('en-IN')}`, startX + 330, currentY);
    totalDiscount += order.couponDiscount;
    currentY += 15;
  }
  
  // Add shipping (assume order.shipping exists; default to 50 if not)
  const shipping = order.shipping || 50;
  doc.text('Shipping:', startX + 250, currentY);
  doc.text(`₹${shipping.toLocaleString('en-IN')}`, startX + 330, currentY);
  currentY += 20;
  
  // Final total line, bold and aligned properly (no extra spaces)
  doc.fontSize(12).font('Helvetica-Bold')
     .text('Total Amount:', startX + 250, currentY);
  doc.text(`₹${order.finalAmount.toLocaleString('en-IN')}`, startX + 330, currentY);
  
  // Add payment method and status below, with more space
  currentY += 40;
  doc.fontSize(10).font('Helvetica')
     .text(`Payment Method: ${order.paymentMethod || 'Not specified'}`, startX, currentY);
  currentY += 20;
  doc.text(`Order Status: ${order.status}`, startX, currentY);
  
  // Footer with ample space
  currentY += 60;
  doc.fontSize(9)
     .text('Thank you for choosing SAWAX!', startX, currentY, { align: 'center', width: 500 })
     .text('This is a computer generated invoice.', startX, currentY + 15, { align: 'center', width: 500 });
  
  // Finalize the PDF
  doc.end();
}

module.exports = { generateInvoicePDF };