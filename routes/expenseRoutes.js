const express = require('express');
const router = express.Router();
const { Expense } = require('../models/expense');
const isUser = require('../controllers/middleware');

// Add new expense
router.post('/expenses', isUser, async (req, res) => {
  try {
    const { title, amount, category, date, note } = req.body;
    const expense = new Expense({
      user: req.user.LoginId,
      title,
      amount,
      category,
      date,
      note
    });
    await expense.save();
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add expense', error: err });
  }
});

// Get all expenses for user
router.get('/expenses', isUser, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.LoginId }).sort({ date: -1 });
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch expenses', error: err });
  }
});

// Get single expense by ID
router.get('/expenses/:id', isUser, async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user.LoginId });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch expense', error: err });
  }
});

// Update an expense
router.put('/expenses/:id', isUser, async (req, res) => {
  try {
    const updated = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.LoginId },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Expense not found or unauthorized' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update expense', error: err });
  }
});

// Delete an expense
router.delete('/expenses/:id', isUser, async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user.LoginId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Expense not found or unauthorized' });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete expense', error: err });
  }
});

module.exports = router;
