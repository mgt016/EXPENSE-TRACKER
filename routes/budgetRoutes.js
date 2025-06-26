// routes/budgetRoutes.js
const express = require('express');
const router = express.Router();
const { Budget } = require('../models/budget');
const { Expense } = require('../models/expense');
const isUser = require('../controllers/middleware');

// Set or update monthly budget (already correct)
router.post('/budget', isUser, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid budget amount' });
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const existingBudget = await Budget.findOne({ user: req.user.LoginId, month, year });

    let budget;
    if (existingBudget) {
      existingBudget.amount = amount;
      budget = await existingBudget.save();
    } else {
      budget = await new Budget({
        user: req.user.LoginId,
        amount,
        month,
        year
      }).save();
    }

    res.status(200).json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to set budget', error });
  }
});

// Get current month's budget + remaining
router.get('/budget', isUser, async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const budget = await Budget.findOne({ user: req.user.LoginId, month, year });

    if (!budget) {
      return res.status(404).json({ success: false, message: 'No budget set for this month' });
    }

    // 🔍 Calculate total spent this month
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

    const expenses = await Expense.find({
      user: req.user.LoginId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = Math.max(0, budget.amount - totalSpent); // don't go negative

    res.status(200).json({
      success: true,
      data: {
        budget: budget.amount,
        totalSpent,
        remaining
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get budget', error });
  }
});

module.exports = router;
