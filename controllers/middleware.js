const jwt = require('jsonwebtoken');
const { jwtsecret } = require('../controllers/config');
const { User } = require('../models/user');


async function isUser(req, res, next) {
  const token = req.headers['token']; // expecting header: token = <JWT>

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Token not provided' });
  }

  try {
    const decoded = jwt.verify(token, jwtsecret);

    // Fetch full user info from DB
    const user = await User.findById(decoded.LoginId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = {
      LoginId: user._id,
      role: user.role,
      name: user.name,
      email: user.email, // ✅ needed for notifications
    };

    next();
  } catch (err) {
    console.log('Auth error:', err);
    return res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
  }
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }
}

module.exports = { isUser , isAdmin };
