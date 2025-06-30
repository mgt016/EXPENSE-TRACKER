const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');


const { Expense } = require('../../../models/expense');
const { Budget } = require('../../../models/budget');
const { isUser } = require('../../../controllers/middleware');
const { Category } = require('../../../models/category');
const { sendTextEmail } = require('../../../controllers/email');

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

    // ========== ALERT CHECK ========== //
    const budgets = await Budget.find({
      user: req.user.LoginId,
      categories: category,
      status: true
    });

    for (const budget of budgets) {
      let startDate, endDate;
      const now = new Date();

      switch (budget.period) {
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(budget.created_at);
          endDate = new Date();
      }

      const totalSpent = await Expense.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(req.user.LoginId),
            category: { $in: [category] },
            date: { $gte: startDate, $lte: endDate },
            status: true
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]);

      const spent = totalSpent[0]?.total || 0;

      // Send alert if over budget and not already notified
      if (spent > budget.amount && !budget.notified) {
        const subject = `⚠️ Budget Limit Exceeded for ${budget.name}`;
        const body = `
Hi ${req.user.name || 'User'},

You've exceeded your budget for category: ${budget.categories.join(", ")}.
🧾 Budget Name: ${budget.name}
💰 Limit: ₹${budget.amount}
💸 Spent: ₹${spent}

Stay on track with your spending goals!
- Your Expense Tracker`;

        console.log(`🚨 ALERT: Sending budget alert email to ${req.user.email}`);
        await sendTextEmail(req.user.email, subject, body, []);
        budget.notified = true;
        await budget.save();
      }

      // Reset notification if user goes back under budget
      if (spent <= budget.amount && budget.notified) {
        budget.notified = false;
        await budget.save();
      }
    }

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Failed to add expense', error: err });
  }
});


// Get all expenses for user with optional time filtering
const { startOfWeek, startOfMonth, startOfYear } = require('date-fns');

router.get('/expenses', isUser, async (req, res) => {
  try {
    const { filter, range, start, end } = req.query;
    const query = { user: req.user.LoginId, status: true };

    const now = new Date();

    if (filter) {
      switch (filter) {
        case 'today': {
          const startOfToday = new Date(now);
          startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date(now);
          endOfToday.setHours(23, 59, 59, 999);
          query.date = { $gte: startOfToday, $lte: endOfToday };
          break;
        }
        case 'this_week': {
          const weekStart = startOfWeek(now, { weekStartsOn: 1 });
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          query.date = { $gte: weekStart, $lte: weekEnd };
          break;
        }
        case 'this_month': {
          const monthStart = startOfMonth(now);
          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
          query.date = { $gte: monthStart, $lte: monthEnd };
          break;
        }
        case 'this_year': {
          const yearStart = startOfYear(now);
          const yearEnd = new Date(yearStart.getFullYear(), 11, 31, 23, 59, 59, 999);
          query.date = { $gte: yearStart, $lte: yearEnd };
          break;
        }
        default:
          return res.status(400).json({ success: false, message: 'Invalid filter' });
      }
    }

    if (range && !filter) {
      const rNow = new Date();
      let startDate = null;
      switch (range) {
        case '7d':
          startDate = new Date(rNow.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(rNow.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '12w':
          startDate = new Date(rNow.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
          break;
        case '6m':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1y':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid range value' });
      }
      query.date = { $gte: startDate };
    }

    if (start && end) {
      const startDateCustom = new Date(start);
      const endDateCustom = new Date(end);
      endDateCustom.setHours(23, 59, 59, 999);
      if (isNaN(startDateCustom) || isNaN(endDateCustom)) {
        return res.status(400).json({ success: false, message: 'Invalid custom dates' });
      }
      query.date = {
        $gte: startDateCustom,
        $lte: endDateCustom
      };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json({ success: true, data: expenses });
  } catch (err) {
    console.error(err);
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
