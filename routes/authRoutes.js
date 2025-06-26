const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const {User} = require('../models/user');
const {Otp} = require('../models/otp');
const {Token} = require('../models/token');
const sendMail = require('../controllers/email');

const jwtsecret = 'your_secret_key';

router.post('/user/register', async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        if (!name || !phone || !email || !password) {
            return res.status(400).json({ status: false, message: 'All fields required!' });
        }

        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(name)) {
            return res.status(400).json({ status: false, message: 'Name must contain only alphabets!' });
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ status: false, message: 'Phone number should contain only numbers and of length 10!' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ status: false, message: 'Invalid email Format!' });
        }

        const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/;
        if (!passRegex.test(password)) {
            return res.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
            });
        }

        const newpassword = await bcryptjs.hash(password, 10);
        const existingUser = await User.findOne({ email });

            if (existingUser && existingUser.isVerified) {
                return res.status(400).json({ status: false, message: 'User already exists!' });
            }

            const otpCode = Math.floor(100000 + Math.random() * 900000);
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

            await Otp.deleteMany({ email });

            if (!existingUser) {
                const newUser = new User({ name, phone, email, password: newpassword});
                await newUser.save();
            } else {
                existingUser.name = name;
                existingUser.phone = phone;
                existingUser.password = newpassword;
                await existingUser.save();
            }

            const user = await User.findOne({ email });
            const newOtp = new Otp({ LoginId: user._id, email, otp: otpCode, expiresAt });
            await newOtp.save();

            await sendMail.sendTextEmail(email, 'OTP for Registration', `Your OTP is ${otpCode}. It is valid for 5 minutes.`);

            return res.status(201).json({ status: true, message: 'User registered successfully. OTP sent to email.' });

        } catch(error){
        console.log(error);        
        return res.status(500).json({status:false, message:'Something went wrong!'});
    }

});


router.post('/user/otp-verification/:otp', async (req, res) => {
    try {
        const otpCode = req.params.otp;
        const { email } = req.body;

        if (!email || !otpCode) {
            return res.status(400).json({ status: false, message: "All fields required!" });
        }

        const verifyOtp = await Otp.findOne({ email, otp: otpCode });

        if (!verifyOtp) return res.status(400).json({ status: false, message: 'Invalid OTP!' });

        if (parseInt(verifyOtp.otp) !== parseInt(otpCode)) return res.status(400).json({ status: false, message: 'Invalid OTP!' });

        if (verifyOtp.expiresAt < new Date()) return res.status(400).json({ status: false, message: 'OTP expired!' });

        const user = await User.findById(verifyOtp.LoginId);
        if (!user) return res.status(404).json({ status: false, message: 'User not found!' });

        user.isVerified = true;
        await user.save();
        await Otp.deleteOne({ _id: verifyOtp._id });


        res.status(200).json({ status: true, message: 'OTP verified successfully!' });

    } catch (error) {
        console.log(error);
        res.status(500).json({ status: false, message: 'Something went wrong' });
    }
});

router.post('/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ status: false, message: 'All fields required!' });
        }

        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(400).json({ status: false, message: 'User not found!' });
        }

        const isMatch = await bcryptjs.compare(password, existingUser.password);
        if (!isMatch) {
            return res.status(400).json({ status: false, message: 'Invalid credentials!' });
        }

        // If user is not admin, check for OTP verification
        if (!existingUser.isVerified) {
            return res.status(400).json({ status: false, message: 'User not verified. Please complete OTP verification.' });
        }

        const token = jwt.sign(
            { LoginId: existingUser._id, role: existingUser.role },
            jwtsecret,
            { expiresIn: '2h' }
        );

        const userToken = new Token({ LoginId: existingUser._id, token });
        await userToken.save();

        return res.status(200).json({
            status: true,
            message: 'Login successful',
            token,
            role: existingUser.role
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: 'Something went wrong' });
    }
});


router.post('/logout', async (req, res) => {
  try {
    const token = req.headers['token']; // ✅ Direct token from headers

    if (!token) {
      return res.status(400).json({ status: false, message: 'Token not provided' });
    }

    // Optional: verify token to ensure it's valid before removing
    try {
      jwt.verify(token, jwtsecret);
    } catch (err) {
      return res.status(401).json({ status: false, message: 'Invalid or expired token' });
    }

    // Delete token from DB (invalidate)
    await Token.deleteOne({ token });

    return res.status(200).json({ status: true, message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ status: false, message: 'Server error during logout' });
  }
});






module.exports = router;