const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  name: {
    type: String,
    required: true
  },
  period: {
    type: String,
    enum: ['week', 'month', 'year', 'one-time'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  categories: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  notified: {
  type: Boolean,
  default: false
},
  status: {
    type: Boolean,
    default: true
  }
});

const Budget = mongoose.model('Budget', budgetSchema);
module.exports = { Budget };
