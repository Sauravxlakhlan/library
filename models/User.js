const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'student' },
    profileImage: { type: String, default: 'default-user.png' } // New Field
});

module.exports = mongoose.model('User', userSchema, 'User');