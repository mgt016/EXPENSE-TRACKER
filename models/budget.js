const mongoose = require('mongoose');
const budgetSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    amount: {
        type: Number
    },
    month: {
        type: Number,
    },
    year: {
        type: Number
    }
});

const Budget = mongoose.model('Budget', budgetSchema);
module.exports = { Budget };