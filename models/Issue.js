const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
    // References & Titles
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    bookTitle: String,
    serialNumber: String,
    
    // Visual Assets (Stored filenames from /uploads/)
    bookImage: { type: String },    // Added: To show book cover in registry
    studentImage: { type: String }, // Added: To show student face in registry

    // User Information
    userName: String,
    userEmail: String,

    // Lifecycle Dates
    requestDate: { type: Date, default: Date.now },
    issueDate: { type: Date },
    dueDate: { type: Date },
    returnDate: { type: Date }, 

    // Financials
    finalFine: { type: Number, default: 0 },

    // State Management
    status: { 
        type: String, 
        default: 'Pending', 
        enum: ['Pending', 'Approved', 'Returned', 'Rejected'] 
    }
});

module.exports = mongoose.model('Issue', issueSchema);