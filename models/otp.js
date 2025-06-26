const mongoose = require('mongoose');
const otpSchema = new mongoose.Schema({
    LoginId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    email: {
        type: String,
        required: true
    },
    otp: {
        type: Number,
        required: true
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: '5m' // OTP will expire after 5 minutes
    }
});

const Otp = mongoose.model('Otp', otpSchema);
module.exports = { Otp }