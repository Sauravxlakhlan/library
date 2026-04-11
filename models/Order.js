const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    bookTitle: String,
    bookPrice: Number,
    userName: String,
    userEmail: String,
    purchaseDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);