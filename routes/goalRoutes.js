const express = require('express');
const router = express.Router();
const { Goal } = require('../models/goal');
const isUser = require('../controllers/middleware');

// POST: Create goal
router.post('/goals', isUser, async (req, res) => {
  try {
    const { name, targetAmount, savedAmount, desiredDate, note } = req.body;

    if (!name || !targetAmount || !desiredDate) {
      return res.status(400).json({ success: false, message: 'Name, target amount and desired date are required' });
    }

    const goal = new Goal({
      user: req.user.LoginId,
      name,
      targetAmount,
      savedAmount: savedAmount || 0,
      desiredDate,
      note
    });

    await goal.save();
    res.status(201).json({ success: true, data: goal });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to create goal', error: err.message });
  }
});

// GET: All active goals
router.get('/goals', isUser, async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.LoginId, status: true });
    res.status(200).json({ success: true, data: goals });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to fetch goals', error: err.message });
  }
});

// PUT: Update a goal
router.put('/goals/:id', isUser, async (req, res) => {
  try {
    const updated = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user.LoginId, status: true },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Goal not found or unauthorized' });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to update goal', error: err.message });
  }
});

// PATCH: Add to savedAmount
router.patch('/goals/:id/add-saving', isUser, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.LoginId, status: true });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

    goal.savedAmount += amount;
    await goal.save();

    res.status(200).json({ success: true, message: 'Amount added', data: goal });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to add saving', error: err.message });
  }
});

// PATCH: Mark goal as reached
router.patch('/goals/:id/reached', isUser, async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user.LoginId, status: true },
      { isReached: true },
      { new: true }
    );
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.status(200).json({ success: true, message: 'Goal marked as reached', data: goal });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to mark goal as reached', error: err.message });
  }
});

// DELETE: delete goal
router.delete('/goals/:id', isUser, async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.LoginId });
    if (!goal || !goal.status) return res.status(404).json({ success: false, message: 'Goal not found or already deleted' });

    goal.status = false;
    await goal.save();

    res.status(200).json({ success: true, message: 'Goal deleted' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to delete goal', error: err.message });
  }
});

// GET: Progress & stats
router.get('/goals/:id/progress', isUser, async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.LoginId, status: true });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });

    const today = new Date();
    const weeksLeft = Math.max(1, Math.ceil((goal.desiredDate - today) / (1000 * 60 * 60 * 24 * 7)));
    const remainingAmount = Math.max(0, goal.targetAmount - goal.savedAmount);
    const perWeekNeeded = remainingAmount / weeksLeft;

    res.status(200).json({
      success: true,
      data: {
        progress: (goal.savedAmount / goal.targetAmount) * 100,
        remainingAmount,
        perWeekNeeded: Math.round(perWeekNeeded)
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to fetch goal progress', error: err.message });
  }
});

module.exports = router;
