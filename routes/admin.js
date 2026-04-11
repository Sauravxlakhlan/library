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
        res.render('admin/students', { students });
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

        res.render('admin/student-details', { student, history, totalFine });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading student profile");
    }
});

// --- BOOK & DASHBOARD ROUTES ---

router.get('/add-book', (req, res) => {
    res.render('admin/add-book'); 
});

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

        res.render('admin/dashboard', { issues: updatedIssues });
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
 * REJECT ROUTE (NEW)
 */
router.post('/reject/:id', async (req, res) => {
    try {
        const issueRequest = await Issue.findById(req.params.id);
        if (!issueRequest) return res.status(404).send("Request node not found");

        // 1. Mark request as Rejected to preserve audit history
        issueRequest.status = 'Rejected';
        await issueRequest.save();

        // 2. Release Asset: Set book status back to Available
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

router.post('/add-book', upload.single('bookImage'), async (req, res) => {
    try {
        const { title, author, serialNumber, description, pages } = req.body;
        
        await Book.create({
            title, author, serialNumber, description, pages,
            image: req.file ? req.file.filename : 'default.jpg',
            status: 'Available' 
        });

        res.redirect('/admin/dashboard');
    } catch (err) {
        if (err.code === 11000) return res.status(400).send("Error: Serial Number must be unique.");
        res.status(500).send("Database Error.");
    }
});

module.exports = router;