const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: String,
    author: String,
    serialNumber: { type: String, unique: true },
    image: String,
    description: String,
    pages: Number,
    status: { 
        type: String, 
        enum: ['Available', 'Requested', 'Issued'], 
        default: 'Available' 
    },
    // CRITICAL: This field must exist to link the book to a student
    issuedTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    }
});

module.exports = mongoose.model('Book', bookSchema);