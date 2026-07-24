// auth.js (middleware)
// This checks that every protected request has a valid login token (JWT).
// If the token is missing or invalid, the request is blocked here —
// it never reaches the actual route logic.

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization; // expected format: "Bearer abc123..."

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = header.split(' ')[1]; // grabs just the token part

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // attach the logged-in user's ID to this request
    next(); // token is valid — allow the request to continue
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = authMiddleware;