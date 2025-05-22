const mongoose = require('mongoose');
const {Schema} = mongoose;

const productSchema = new Schema({
    productName:{
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
   
    brand:{
        type: String,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId, //  Store ObjectId instead of String
        ref: 'Category', //  Reference the Category collection
        required: true
    },
   
    salePrice:{
        type: Number,
        required: true
    },
    productOffer:{
        type: Number,
        default: 0
    },
    quantity:{
        type: Number,
        required: true
    },
    color:{
        type: String,
        required: true
    },
   
    productImage:{
        type: [String],
        required: true
    },
    isBlocked:{
        type: Boolean,
        default: false
    },
    status:{
        type: String,
        enum:['available','out of stock','Discontinued'],
        required: true,
        default: 'available'
    },
},{timestamps: true})

const Product = mongoose.model('Product', productSchema);

module.exports = Product;