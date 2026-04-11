const express = require('express');
const router = express.Router();
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

// Multer Storage Configuration for Profile Pictures
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        // Saves file as: timestamp-profile.jpg
        cb(null, Date.now() + '-profile' + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2000000 }, // Limit 2MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) return cb(null, true);
        cb("Error: Images Only!");
    }
});

// GET: Render Signup Page
router.get('/signup', (req, res) => {
    res.render('auth/signup');
});

// POST: Handle Signup with Profile Image
router.post('/signup', upload.single('profileImage'), async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        // If no file is uploaded, use a default image name
        const profileImage = req.file ? req.file.filename : 'default-user.png';

        await User.create({ 
            name, 
            email, 
            password, 
            role, 
            profileImage // Save filename to DB
        });
        
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error creating account. Email might already exist.");
    }
});

// GET: Render Login Page
router.get('/login', (req, res) => {
    res.render('auth/login');
});

// POST: Handle Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        
        if (user && user.password === password) {
            // Set Session Data
            req.session.userId = user._id;
            req.session.role = user.role;
            req.session.userName = user.name;
            req.session.userEmail = user.email;
            // ADDED: Save profile image to session so we can pass it to the Issue Registry later
            req.session.userImage = user.profileImage; 

            if (user.role === 'admin') {
                res.redirect('/admin/dashboard'); 
            } else {
                res.redirect('/dashboard');
            }
        } else {
            res.send("Invalid Email or Password");
        }
    } catch (err) {
        res.status(500).send("Login Error");
    }
});

// GET: Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
});

module.exports = router;