const express =  require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
var useragent = require('express-useragent');



const router = require('./routes/v1/user/authRoutes');
const routerAdmin = require('./routes/v1/admin/adminRoutes');
const expenseRoutes = require('./routes/v1/user/expenseRoutes');
const budgetRoutes = require('./routes/v1/user/budgetRoutes');
const analyticsRoutes = require('./routes/v1/user/analyticsRoutes');
const goalRoutes = require('./routes/v1/user/goalRoutes');





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

mongoose.connect('mongodburl'

).then(() => {
    console.log('DATABASE CONNECTED SUCCESSFULLY');
}).catch((err) => {
    console.log('Error connecting to database');
    console.log(err);
});

app.use(express.json());
app.use(router); 
app.use(routerAdmin);
app.use('/api', expenseRoutes);
app.use('/api', budgetRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', goalRoutes);





const server = app.listen(port, function () {
    console.log("SERVER RUNNING ON PORT : " + port);
});
