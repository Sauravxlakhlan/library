const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Issue = require('../models/Issue');
const User = require('../models/User'); 
const multer = require('multer');
const path = require('path');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Middleware to protect all admin routes
const isAdmin = (req, res, next) => {
    if (req.session.role === 'admin') return next();
    res.redirect('/auth/login');
};

router.use(isAdmin);

// --- STUDENT MANAGEMENT ROUTES ---

// GET: View all registered students
router.get('/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' });
        // Added page: 'students' for navbar highlighting
        res.render('admin/students', { students, page: 'students' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching student directory");
    }
});

// GET: View specific student details
router.get('/students/:id', async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student) return res.status(404).send("Student not found");

        const history = await Issue.find({ userEmail: student.email }).sort({ requestDate: -1 });
        const totalFine = history.reduce((acc, curr) => acc + (curr.finalFine || 0), 0);

        // Added page: 'students' so the Directory tab stays active
        res.render('admin/student-details', { student, history, totalFine, page: 'students' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading student profile");
    }
});

// --- ASSET INVENTORY & STATUS TOGGLE ---

// GET: View all books in library (books.ejs)
router.get('/books', async (req, res) => {
    try {
        const books = await Book.find().sort({ title: 1 });
        // Added page: 'books' for navbar highlighting (Assets button)
        res.render('admin/books', { books, page: 'books' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading asset inventory");
    }
});

// POST: Toggle Active/Inactive status
router.post('/books/toggle-status/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).send("Asset not found");

        // Logic: If Inactive -> Available | If anything else -> Inactive
        const newStatus = book.status === 'Inactive' ? 'Available' : 'Inactive';
        
        await Book.findByIdAndUpdate(req.params.id, { status: newStatus });
        res.redirect('/admin/books');
    } catch (err) {
        console.error("Toggle Error:", err);
        res.status(500).send("Failed to toggle asset status.");
    }
});

// --- DASHBOARD & REGISTRY ROUTES ---

router.get('/dashboard', async (req, res) => {
    try {
        const issues = await Issue.find().sort({ requestDate: -1 });
        
        const updatedIssues = issues.map(item => {
            let fine = 0;
            const today = new Date();
            
            if (item.status === 'Returned') {
                fine = item.finalFine || 0;
            } else if (item.status === 'Approved' && item.dueDate && today > item.dueDate) {
                const diffTime = Math.abs(today - item.dueDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                fine = diffDays * 5; 
            }
            
            return { 
                ...item._doc, 
                fine,
                issueDateStr: item.issueDate ? item.issueDate.toDateString() : 'N/A',
                dueDateStr: item.dueDate ? item.dueDate.toDateString() : 'N/A',
                requestDateStr: item.requestDate ? item.requestDate.toDateString() : 'N/A'
            };
        });

        // Added page: 'dashboard' for navbar highlighting (Registry button)
        res.render('admin/dashboard', { issues: updatedIssues, page: 'dashboard' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading admin dashboard");
    }
});

// --- ACTION LOGIC ROUTES ---

/**
 * APPROVE ROUTE
 */
router.post('/approve/:id', async (req, res) => {
    try {
        const issueRequest = await Issue.findById(req.params.id);
        if (!issueRequest) return res.status(404).send("Request not found");

        const student = await User.findOne({ email: issueRequest.userEmail });
        if (!student) return res.status(404).send("Student not found");

        const issueDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(issueDate.getDate() + 7);

        issueRequest.status = 'Approved';
        issueRequest.issueDate = issueDate;
        issueRequest.dueDate = dueDate;
        await issueRequest.save();

        await Book.findByIdAndUpdate(issueRequest.bookId, { 
            status: 'Issued',
            issuedTo: student._id 
        });

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Approval Error:", err);
        res.status(500).send("Failed to approve the request.");
    }
});

/**
 * REJECT ROUTE
 */
router.post('/reject/:id', async (req, res) => {
    try {
        const issueRequest = await Issue.findById(req.params.id);
        if (!issueRequest) return res.status(404).send("Request node not found");

        issueRequest.status = 'Rejected';
        await issueRequest.save();

        await Book.findByIdAndUpdate(issueRequest.bookId, { 
            status: 'Available',
            issuedTo: null 
        });

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Rejection Error:", err);
        res.status(500).send("System failed to process rejection.");
    }
});

/**
 * RETURN ROUTE
 */
router.post('/return/:id', async (req, res) => {
    try {
        const issue = await Issue.findById(req.params.id);
        if (!issue) return res.status(404).send("Record not found");

        const today = new Date();
        let fine = 0;

        if (today > issue.dueDate) {
            const diffTime = Math.abs(today - issue.dueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            fine = diffDays * 5;
        }

        issue.status = 'Returned';
        issue.returnDate = today;
        issue.finalFine = fine;
        await issue.save();

        await Book.findByIdAndUpdate(issue.bookId, { 
            status: 'Available',
            issuedTo: null 
        });

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Return Error:", err);
        res.status(500).send("Return process failed.");
    }
});

// --- ASSET CREATION ---

router.get('/add-book', (req, res) => {
    // Passes page: 'books' so the Assets tab is highlighted while adding
    res.render('admin/add-book', { page: 'books' }); 
});

router.post('/add-book', upload.single('bookImage'), async (req, res) => {
    try {
        const { title, author, serialNumber, description, pages } = req.body;
        
        await Book.create({
            title, author, serialNumber, description, pages,
            image: req.file ? req.file.filename : 'default.jpg',
            status: 'Available' 
        });

        res.redirect('/admin/books'); 
    } catch (err) {
        if (err.code === 11000) return res.status(400).send("Error: Serial Number must be unique.");
        res.status(500).send("Database Error.");
    }
});

module.exports = router;