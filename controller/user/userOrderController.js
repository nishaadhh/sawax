const Order = require("../../models/orderSchema");

const getUserOrders = async (req, res) => {
    try {
        
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).send("Unauthorized: Please log in");
        }

        const orders = await Order.find({ userId })
            .populate({
                path: "orderedItems.product",
                select: "productName productImage price quantity",
            })
            .sort({ orderDate: -1 });

        res.render("order-history", {
            orders,
            title: "Order History",
        });
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = { getUserOrders };