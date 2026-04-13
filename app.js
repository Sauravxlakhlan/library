require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

// Import Models
const Book = require('./models/Book');
const Issue = require('./models/Issue'); 

const app = express();

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to Library Database Successfully"))
    .catch(err => console.log("Database Connection Error:", err));

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'library_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } 
}));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/user'));

// Root Path Redirect
app.get('/', (req, res) => res.redirect('/auth/login'));

/**
 * STUDENT DASHBOARD
 * Updated to filter out 'Inactive' books and pass navigation context
 */
app.get('/dashboard', async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) return res.redirect('/auth/login');
    
    try {
        // FILTER: Only fetch books that are NOT 'Inactive'
        const books = await Book.find({ status: { $ne: 'Inactive' } });
        
        // currentUserId is passed to fix EJS ReferenceErrors in the Vault logic
        res.render('dashboard', { 
            books: books, 
            user: req.session.userName,
            currentUserId: req.session.userId,
            page: 'dashboard' // Added for navbar highlighting if needed
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).send("Error loading dashboard");
    }
});

/**
 * ISSUE LOGIC
 * Captures book and user data for Admin verification
 */
app.post('/issue/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');

    try {
        const book = await Book.findById(req.params.id);
        
        // Safety check: Only allow requests for books that are actually Available
        if (book && book.status === 'Available') {
            // Create a Request with Visual Data for the Admin Registry
            await Issue.create({
                bookId: book._id,
                bookTitle: book.title,
                serialNumber: book.serialNumber,
                bookImage: book.image,           // From Book model
                studentImage: req.session.userImage, // From User Session
                userName: req.session.userName,
                userEmail: req.session.userEmail,
                status: 'Pending'
            });

            // Update book status to prevent double-requests
            book.status = 'Requested'; 
            await book.save();

            res.send(`
                <script>
                    alert('Request sent! Images attached for Admin verification.');
                    window.location.href = '/dashboard';
                </script>
            `);
        } else {
            res.send(`
                <script>
                    alert('Book is currently unavailable, inactive, or already requested.'); 
                    window.location.href='/dashboard';
                </script>
            `);
        }
    } catch (err) {
        console.error("Issue Error:", err);
        res.status(500).send("Error processing request.");
    }
});

// Server Configuration
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Running: http://localhost:${PORT}`);
});