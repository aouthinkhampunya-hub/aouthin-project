const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../routes/auth');

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'ກະລນາເຂົ້າສູ່ລະບົບກ່ອນ' });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session ໝົດອາຍຸ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່' });
  }
}

module.exports = requireAuth;