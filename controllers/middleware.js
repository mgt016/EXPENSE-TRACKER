const jwt = require('jsonwebtoken');
const { jwtsecret } = require('../controllers/config');

function isUser(req, res, next) {
  const token = req.headers['token']; // expecting header: token = <JWT>

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token not provided' });
  }

  try {
    const decoded = jwt.verify(token, jwtsecret);
    req.user = decoded; // sets req.user.LoginId and other data in token
    next();
  } catch (err) {
    console.log(err);
    
    return res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
  }
}

module.exports = isUser;
