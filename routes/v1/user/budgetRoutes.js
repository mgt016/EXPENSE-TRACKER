const express = require('express');
const router = express.Router();
const { Budget } = require('../../../models/budget');
const { Expense } = require('../../../models/expense');
const { isUser } = require('../../../controllers/middleware');
const { Category } = require('../../../models/category');

// Create Budget
router.post('/budgets', isUser, async (req, res) => {
  try {
    const { name, period, amount, categories } = req.body;
    if (!name || !period || !amount || !categories || !categories.length) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

// Validate all categories
    const validCategories = await Category.find({ name: { $in: categories } });
    if (validCategories.length !== categories.length) {
      return res.status(400).json({
      success: false,
      message: 'One or more selected categories are invalid. Use only predefined categories.'
    });
  }

  const budget = new Budget({
    user: req.user.LoginId,
    name,
    period,
    amount,
    categories
  });

  await budget.save();
  res.status(201).json({ success: true, data: budget });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to create budget', error: err });
  }
  });

// Get All Budgets (with usage info)
router.get('/budgets', isUser, async (req, res) => {
  try {
    const budgets = await Budget.find({ user: req.user.LoginId, status: true });

    const today = new Date();
    const enriched = await Promise.all(
      budgets.map(async budget => {
        let startDate;
        switch (budget.period) {
          case 'week':
            startDate = new Date(today); startDate.setDate(today.getDate() - 7); break;
          case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1); break;
          case 'year':
            startDate = new Date(today.getFullYear(), 0, 1); break;
          default:
            startDate = new Date(0);
        }

        const expenses = await Expense.find({
          user: req.user.LoginId,
          category: { $in: budget.categories },
          date: { $gte: startDate, $lte: today },
          status: true
        });

        const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
        const remaining = Math.max(0, budget.amount - totalSpent);

        return {
          ...budget.toObject(),
          totalSpent,
          remaining
        };
      })
    );

    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch budgets', error: err });
  }
});


// Update Budget Details
router.put('/budgets/:id', isUser, async (req, res) => {
  try {
  const { name, period, amount, categories } = req.body;
  const updateFields = {};

  if (name) updateFields.name = name;
  if (period) updateFields.period = period;
  if (amount) updateFields.amount = amount;

  if (categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ success: false, message: 'Categories must be a non-empty array' });
    }

    const validCategories = await Category.find({ name: { $in: categories } });
    if (validCategories.length !== categories.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected categories are invalid. Use only predefined categories.'
      });
    }

    updateFields.categories = categories;
  }

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
  }

  const updated = await Budget.findOneAndUpdate(
    { _id: req.params.id, user: req.user.LoginId, status: true },
    updateFields,
    { new: true }
  );

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Budget not found or unauthorized' });
  }

  res.status(200).json({ success: true, data: updated });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update budget', error: err });
  }
});


//  Delete Budget
router.delete('/budgets/:id', isUser, async (req, res) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, user: req.user.LoginId });
    if (!budget || !budget.status) return res.status(404).json({ success: false, message: 'Budget not found or already deleted' });

    budget.status = false;
    await budget.save();

    res.json({ success: true, message: 'Budget deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete budget', error: err });
  }
});


module.exports = router;
