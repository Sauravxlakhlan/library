const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Issue = require('../models/Issue');

// Middleware to check if user is logged in
const isStudent = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect('/auth/login');
};

router.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');

    try {
        const books = await Book.find();
        res.render('dashboard', { 
            books, 
            user: req.session.userName,
            currentUserId: req.session.userId
        });
    } catch (err) {
        res.status(500).send("Error loading dashboard");
    }
});

/**
 * ISSUE LOGIC
 */
router.post('/issue/:id', isStudent, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        
        if (book && book.status === 'Available') {
            await Issue.create({
                bookId: book._id,
                bookTitle: book.title,
                serialNumber: book.serialNumber,
                bookImage: book.image,
                studentImage: req.session.userImage,
                userName: req.session.userName,
                userEmail: req.session.userEmail,
                status: 'Pending'
            });

            book.status = 'Requested'; 
            await book.save();

            res.send(`
                <script>
                    alert('Request sent! Images attached for Admin verification.');
                    window.location.href = '/dashboard';
                </script>
            `);
        } else {
            res.send("<script>alert('Book unavailable.'); window.location.href='/dashboard';</script>");
        }
    } catch (err) {
        console.error("Issue Error:", err);
        res.status(500).send("Error processing request.");
    }
});

module.exports = router;