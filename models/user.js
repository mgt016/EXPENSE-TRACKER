const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    user: {
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