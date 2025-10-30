const jwt = require('jsonwebtoken');

module.exports = function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
  if (err) {
    console.log('JWT error:', err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  console.log('Decoded user:', user);
  req.user = user;
  next();
});
};
