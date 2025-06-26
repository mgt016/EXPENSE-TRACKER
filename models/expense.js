const mongoose = require('mongoose');
const expenseSchema = new mongoose.Schema({
user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
},
title: {
    type: String,
},
amount: {
    type: Number
},
category: {
    type: String
},
date: {
    type: Date
},
note: {
    type: String
},
created_at: { 
    type: Date, 
    default: Date.now 
},
status: {
    type: Boolean,
    default: true
}
});


const Expense = mongoose.model('Expense', expenseSchema);
module.exports = { Expense };