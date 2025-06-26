const express =  require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
var useragent = require('express-useragent');



const router = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');




let app = express();
app.use(bodyParser.urlencoded(
    { extended: true , limit: '150mb' }));
app.use(bodyParser.json(
    { limit: '150mb' }));


var port = 2000;
app.use(function (req, res, next) {

res.setHeader('Access-Control-Allow-Origin', '*');

res.setHeader('Access-Control-Allow-Methods', 'GET,POST, OPTIONS, PUT, PATCH, DELETE');

res.setHeader('Access-Control-Allow-Headers',
'X-Requested-With,content-type');

res.setHeader('Access-Control-Allow-Credentials',
true);

next();
});
app.use(cors());
app.use(helmet({crossOriginResourcePolicy:false}));

app.use(useragent.express());
app.use((req,res,next) => {
    var fullUrl = req.protocol + '://' + req.get('host') +
    req.originalUrl;
    console.log(fullUrl);
    next();
    
});

mongoose.connect('mongodb+srv://milangthomas00:kunaguero16@cluster0.xdf6qpy.mongodb.net/EXPENSE-TRACKER?retryWrites=true&w=majority&appName=Cluster0'

).then(() => {
    console.log('DATABASE CONNECTED SUCCESSFULLY');
}).catch((err) => {
    console.log('Error connecting to database');
    console.log(err);
});

app.use(express.json());
app.use(router); 
app.use('/api', expenseRoutes);
app.use('/api', budgetRoutes);
app.use('/api', analyticsRoutes);




const server = app.listen(port, function () {
    console.log("SERVER RUNNING ON PORT : " + port);
});