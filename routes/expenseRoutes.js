const express = require('express');
const router = express.Router();
const { Expense } = require('../models/expense');
const isUser = require('../controllers/middleware');
const { Category } = require('../models/category');


router.post('/categories/init', async (req, res) => {
  try {
    const predefined = [
      'Food & Drinks',
      'Shopping',
      'Housing',
      'Transportation',
      'Vehicle',
      'Life & Entertainment',
      'Communication, PC',
      'Financial expenses',
      'Investments',
      'Income',
      'Others'
    ];

    const bulk = predefined.map(name => ({ name }));
    await Category.deleteMany(); // optional reset
    await Category.insertMany(bulk);

    res.status(201).json({ success: true, message: 'Categories initialized' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Init failed', error: err });
  }
});

// Fetch categories for dropdown in frontend
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort('name');
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: err });
  }
});

// Add new expense
router.post('/expenses', isUser, async (req, res) => {
  try {
    const { title, amount, category, date, note } = req.body;

    // Validate category
    const valid = await Category.findOne({ name: category });
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

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
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to add expense', error: err });
  }
});


// Get all expenses for user with optional time filtering
const { isSameDay, startOfWeek, startOfMonth, startOfYear } = require('date-fns');

router.get('/expenses', isUser, async (req, res) => {
  try {
    const { filter, range, start, end } = req.query;
    const query = { user: req.user.LoginId, status: true };
    const now = new Date();
    let startDate = null;

    // 1. Predefined filters
    if (filter) {
      switch (filter) {
        case 'today':
          query.date = {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lte: new Date(now.setHours(23, 59, 59, 999))
          };
          break;
        case 'this_week':
          startDate = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
          query.date = { $gte: startDate };
          break;
        case 'this_month':
          startDate = startOfMonth(new Date());
          query.date = { $gte: startDate };
          break;
        case 'this_year':
          startDate = startOfYear(new Date());
          query.date = { $gte: startDate };
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid filter' });
      }
    }

    // 2. Relative range (7d, 6m etc.)
    if (range && !filter) {
      const rNow = new Date();
      switch (range) {
        case '7d':
          startDate = new Date(rNow.setDate(rNow.getDate() - 7));
          break;
        case '30d':
          startDate = new Date(rNow.setDate(rNow.getDate() - 30));
          break;
        case '12w':
          startDate = new Date(rNow.setDate(rNow.getDate() - 12 * 7));
          break;
        case '6m':
          startDate = new Date(rNow.setMonth(rNow.getMonth() - 6));
          break;
        case '1y':
          startDate = new Date(rNow.setFullYear(rNow.getFullYear() - 1));
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid range value' });
      }
      query.date = { $gte: startDate };
    }

    // 3. Custom date range
    if (start && end) {
      const startDateCustom = new Date(start);
      const endDateCustom = new Date(end);
      if (isNaN(startDateCustom) || isNaN(endDateCustom)) {
        return res.status(400).json({ success: false, message: 'Invalid custom dates' });
      }
      query.date = {
        $gte: startDateCustom,
        $lte: endDateCustom
      };
    }

    // 🔍 Final query
    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json({ success: true, data: expenses });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses', error: err });
  }
});



// Get single expense
router.get('/expenses/:id', isUser, async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user.LoginId, status: true });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, data: expense });
  } catch (err) {
    console.log(err);
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
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to update expense', error: err });
  }
});

// Delete an expense
router.delete('/expenses/:id', isUser, async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user.LoginId });

    if (!expense || !expense.status) {
      return res.status(404).json({ success: false, message: 'Expense not found or already deleted' });
    }

    expense.status = false;
    await expense.save();

    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to delete expense', error: err });
  }
});






module.exports = router;
