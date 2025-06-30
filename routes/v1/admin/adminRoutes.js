const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');


const { isUser, isAdmin } = require('../../../controllers/middleware');
const { sendTextEmail, sendHtmlEmail } = require('../../../controllers/email');


const { jwtsecret } = require('../../../controllers/config');

const env = require('../../../controllers/config.gmail.env');
const { User } = require('../../../models/user');
const { Expense } = require('../../../models/expense');
const { Otp } = require('../../../models/otp');
const { Goal } = require('../../../models/goal');
const { Budget } = require('../../../models/budget');
const { Token } = require('../../../models/token');

//  Admin Register (one-time use, ideally)
router.post('/admin/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ status: false, message: 'All fields are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Admin already exists' });

    const hash = await bcryptjs.hash(password, 10);
    const admin = new User({ name, email, password: hash, phone: 0, isVerified: true, role: 'admin' });
    await admin.save();

    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Admin registration failed', error: err });
  }
});

// Admin Login (with OTP generation)
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const match = await bcryptjs.compare(password, admin.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const otpCode = Math.floor(100000 + Math.random() * 900000);

    // Save new OTP
    await Otp.deleteMany({ email });
    await new Otp({
      LoginId: admin._id,
      email,
      otp: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 mins
    }).save();

    const subject = "OTP for Admin Login";
    const body = `Hi Admin,\n\nYour OTP for login is ${otpCode}. It is valid for 5 minutes.\n\n- Expense Tracker`;

    await sendTextEmail(email, subject, body, []);

    return res.status(200).json({ status: true, message: 'OTP sent to email. Please verify.' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Login failed', error: err });
  }
});

// Admin OTP Verification and Final Login Token Generation
router.post('/admin/otp-verification/:otp', async (req, res) => {
  try {
    const otpCode = req.params.otp;
    const { email } = req.body;

    const otpRecord = await Otp.findOne({ email, otp: otpCode });
    if (!otpRecord) {
      return res.status(400).json({ status: false, message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ status: false, message: 'OTP expired' });
    }

    const admin = await User.findById(otpRecord.LoginId);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ status: false, message: 'Admin not found' });
    }

    // Generate token now that OTP is valid
    const token = jwt.sign(
      { LoginId: admin._id, role: 'admin' },
      jwtsecret,
      { expiresIn: '2h' }
    );

    const tokenStore = new Token({ LoginId: admin._id, token });
    await tokenStore.save();

    await Otp.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      success: true,
      message: 'OTP verified. Admin login successful.',
      token
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Something went wrong' });
  }
});


//  Admin Logout
router.post('/admin/logout', async (req, res) => {
  try {
    const token = req.headers['token'];
    if (!token) return res.status(400).json({ message: 'Token required' });

    await Token.deleteOne({ token });
    res.json({ success: true, message: 'Admin logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Logout failed', error: err });
  }
});

//  View all users
router.get('/admin/users', isUser, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).select('-password');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// View all expenses of a user
router.get('/admin/user/:userId/expenses', isUser, isAdmin, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.params.userId });
    res.json({ success: true, expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch expenses' });
  }
});

// Delete user account 
router.delete('/admin/user/:userId', isUser, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role === 'admin') return res.status(404).json({ message: 'User not found' });

    user.status = false;
    await user.save();
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to deactivate user' });
  }
});

// Activate a user account
router.put('/admin/user/:userId/activate', isUser, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user || user.role === 'admin') {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = true;
    await user.save();

    res.json({ success: true, message: 'User activated successfully' });
  } catch (err) {
    console.error('Activation error:', err);
    res.status(500).json({ message: 'Failed to activate user' });
  }
});

// Get platform stats (e.g. total users, total expenses, total goals)
router.get('/admin/stats', isUser, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalExpenses = await Expense.countDocuments();
    const totalGoals = await Goal.countDocuments();
    const totalBudget = await Budget.countDocuments();

    res.json({
      success: true,
      stats: { totalUsers, totalExpenses, totalGoals, totalBudget }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// Export expenses (e.g., in JSON for now)
router.get('/admin/export/expenses', isUser, isAdmin, async (req, res) => {
  try {
    const expenses = await Expense.find();
    res.setHeader('Content-Disposition', 'attachment; filename=expenses.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(expenses, null, 2));
  } catch (err) {
    res.status(500).json({ message: 'Export failed' });
  }
});

module.exports = router;
