const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    name: {
        type: String
    },
    email: {
        type: String
    },
    password: {
        type: String
    },
    phone: {
        type: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    }
});

const User = mongoose.model('Login', userSchema)
module.exports = {User};