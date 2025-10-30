const express = require('express');
const router = express.Router();

// Example: Get current user profile
router.get('/me', (req, res) => {
  const user = req.user; // assuming JWT middleware sets this
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(user);
});

module.exports = router;
