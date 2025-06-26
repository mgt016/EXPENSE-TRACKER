const express = require('express');
const router = express.Router();
const { Expense } = require('../models/expense');
const isUser = require('../controllers/middleware');

const categoryColors = {
  "Food & Drinks": "#f94144",
  "Shopping": "#f3722c",
  "Housing": "#f8961e",
  "Transportation": "#f9844a",
  "Vehicle": "#f9c74f",
  "Life & Entertainment": "#90be6d",
  "Communication, PC": "#43aa8b",
  "Financial expenses": "#577590",
  "Investments": "#277da1",
  "Income": "#8e44ad",
  "Others": "#34495e"
};

// 📊 GET Pie Chart Data (Last 30 Days)
router.get('/analytics/piechart', isUser, async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const expenses = await Expense.aggregate([
      {
        $match: {
          user: req.user.LoginId,
          status: true,
          date: { $gte: thirtyDaysAgo, $lte: today }
        }
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" }
        }
      },
      {
        $project: {
          category: "$_id",
          total: 1,
          _id: 0
        }
      }
    ]);

    const result = expenses.map(item => ({
      ...item,
      color: categoryColors[item.category] || "#95a5a6"
    }));

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate pie chart data', error: err });
  }
});

module.exports = router;
