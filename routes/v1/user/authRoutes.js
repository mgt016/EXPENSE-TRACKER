const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const {User} = require('../../../models/user');
const {Otp} = require('../../../models/otp');
const {Token} = require('../../../models/token');
const sendMail = require('../../../controllers/email');
const { jwtsecret } = require('../../../controllers/config');
const { isUser } = require('../../../controllers/middleware');

router.post('/user/register', async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !email || !password || !role) {
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
      return res.status(400).json({ status: false, message: 'Invalid email format!' });
    }

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/;
    if (!passRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ status: false, message: 'User already exists and is verified!' });
    }

    // If user doesn't exist, create new one
    if (!existingUser) {
      const newUser = new User({ name, phone, email, password: hashedPassword, role });
      await newUser.save();
    } else {
      // If user exists but not verified, update details and resend OTP
      existingUser.name = name;
      existingUser.phone = phone;
      existingUser.password = hashedPassword;
      existingUser.role = role;
      await existingUser.save();
    }

    const user = await User.findOne({ email });

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.deleteMany({ email });

    const newOtp = new Otp({ LoginId: user._id, email, otp: otpCode, expiresAt });
    await newOtp.save();

    await sendMail.sendTextEmail(
      email,
      'OTP for Registration',
      `Hi ${user.name},\n\nYour OTP for email verification is ${otpCode}. It is valid for 5 minutes.\n\n- Expense Tracker`
    );

    return res.status(201).json({
      status: true,
      message: 'OTP sent to email. Please verify to complete registration.'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Something went wrong!' });
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

    if (!verifyOtp || parseInt(verifyOtp.otp) !== parseInt(otpCode)) {
      return res.status(400).json({ status: false, message: 'Invalid OTP!' });
    }

    if (verifyOtp.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: verifyOtp._id });
      return res.status(400).json({ status: false, message: 'OTP expired!' });
    }

    const user = await User.findById(verifyOtp.LoginId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found!' });
    }

    // Ensure this is registration verification
    if (user.isVerified) {
      await Otp.deleteOne({ _id: verifyOtp._id });
      return res.status(400).json({ status: false, message: 'User already verified. Please login.' });
    }

    // Mark user as verified
    user.isVerified = true;
    await user.save();

    // Generate token to auto-login
    const token = jwt.sign(
      { LoginId: user._id, role: user.role },
      jwtsecret,
      { expiresIn: '2h' }
    );

    const userToken = new Token({ LoginId: user._id, token });
    await userToken.save();

    await Otp.deleteOne({ _id: verifyOtp._id });

    return res.status(200).json({
      status: true,
      message: 'User verified successfully and logged in.',
      token
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: 'OTP verification failed' });
  }
});



router.post('/user/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: false, message: 'All fields required!' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found!' });
    }

    if (user.status === false) {
      return res.status(403).json({ status: false, message: 'Your account has been deactivated by admin.' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: false, message: 'Invalid credentials!' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ status: false, message: 'User not verified via email OTP.' });
    }

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await Otp.deleteMany({ email }); // Remove old OTPs

    await new Otp({ LoginId: user._id, email, otp: otpCode, expiresAt }).save();

    await sendMail.sendTextEmail(
      email,
      'OTP for Login',
      `Hi ${user.name},\n\nYour OTP for login is ${otpCode}. It is valid for 5 minutes.\n\n- Expense Tracker`
    );

    return res.status(200).json({ status: true, message: 'OTP sent to your email for login verification.' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Login initiation failed.' });
  }
});



router.post('/user/login/otp-verification/:otp', async (req, res) => {
  try {
    const otpCode = req.params.otp;
    const { email } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ status: false, message: "All fields required!" });
    }

    const verifyOtp = await Otp.findOne({ email, otp: otpCode });

    if (!verifyOtp || parseInt(verifyOtp.otp) !== parseInt(otpCode)) {
      return res.status(400).json({ status: false, message: 'Invalid OTP!' });
    }

    if (verifyOtp.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: verifyOtp._id });
      return res.status(400).json({ status: false, message: 'OTP expired!' });
    }

    const user = await User.findById(verifyOtp.LoginId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found!' });
    }

    const token = jwt.sign(
      { LoginId: user._id, role: user.role },
      jwtsecret,
      { expiresIn: '2h' }
    );

    const userToken = new Token({ LoginId: user._id, token });
    await userToken.save();

    await Otp.deleteOne({ _id: verifyOtp._id });

    return res.status(200).json({
      status: true,
      message: 'Login successful after OTP verification.',
      token,
      role: user.role
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: 'OTP verification failed' });
  }
});



router.post('/logout', async (req, res) => {
  try {
    const token = req.headers['token']; // Direct token from headers

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

// User Profile Update — Only updates fields provided in the request
router.put('/user/update-profile', isUser, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const user = await User.findOne({ _id: req.user.LoginId, role: 'user' });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found or unauthorized' });
    }

    if (!name && !email && !phone) {
      return res.status(400).json({ status: false, message: 'Nothing to update' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    await user.save();

    return res.status(200).json({
      status: true,
      message: 'Profile updated successfully',
      updated: {
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('User profile update failed:', error);
    return res.status(500).json({ status: false, message: 'Profile update failed' });
  }
});



//change password using old password
router.put('/user/change-password', isUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: false, message: 'Both current and new passwords are required' });
    }

    const user = await User.findById(req.user.LoginId);
    const isMatch = await bcryptjs.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ status: false, message: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcryptjs.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    return res.status(200).json({ status: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Failed to change password' });
  }
});


//forgot password or reset password
router.post('/user/request-reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });

    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.deleteMany({ email });
    await new Otp({ LoginId: user._id, email, otp: otpCode, expiresAt }).save();

    await sendMail.sendTextEmail(
      email,
      'OTP for Password Reset',
      `Hi ${user.name},\n\nYour OTP for password reset is ${otpCode}. It is valid for 5 minutes.\n\n- Expense Tracker`
    );

    return res.status(200).json({ status: true, message: 'OTP sent to your email for password reset' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Failed to send OTP' });
  }
});

//otp verification for password reset
router.post('/user/reset-password/:otp', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const otpCode = req.params.otp;

    if (!email || !otpCode || !newPassword) {
      return res.status(400).json({ status: false, message: 'All fields are required' });
    }

    const verifyOtp = await Otp.findOne({ email, otp: otpCode });
    if (!verifyOtp || verifyOtp.expiresAt < new Date()) {
      return res.status(400).json({ status: false, message: 'Invalid or expired OTP' });
    }

    const hashedNewPassword = await bcryptjs.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedNewPassword });

    await Otp.deleteOne({ _id: verifyOtp._id });

    return res.status(200).json({ status: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Failed to reset password' });
  }
});






module.exports = router;