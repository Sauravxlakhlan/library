const express = require('express');
const router = express.Router();
const Book = require('../models/Book');

// This logic is currently in your app.js as well, 
// but you can move it here for better organization.
router.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');

    try {
        const books = await Book.find();
        res.render('dashboard', { 
            books: books, 
            user: req.session.userName 
        });
    } catch (err) {
        res.status(500).send("Error loading dashboard");
    }
});

module.exports = router;