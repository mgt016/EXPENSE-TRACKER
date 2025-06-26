const mongoose = require('mongoose');
const tokenSchema = new mongoose.Schema({
    LoginId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    token: {
        type: String
    }
}) 
const Token = mongoose.model('Token', tokenSchema);

module.exports = {Token};