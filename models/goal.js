const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  name: String,
  targetAmount: Number,
  savedAmount: { type: Number, default: 0 },
  desiredDate: Date,
  note: String,
  isReached: { type: Boolean, default: false },
  status: { 
    type: Boolean, 
    default: true 
},
  createdAt: { type: Date, default: Date.now }
});

const Goal = mongoose.model('Goal', goalSchema);
module.exports = { Goal };