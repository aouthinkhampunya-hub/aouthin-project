const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../routes/auth');

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'ກະລນາເຂົ້າສູ່ລະບົບກ່ອນ' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session ໝົດອາຍຸ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່' });
  }
}

function requireOwner(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'ກະລນາເຂົ້າສູ່ລະບົບກ່ອນ' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'owner') {
      return res.status(403).json({ error: 'ສະເພາະເຈົ້າຂອງຮ້ານເທົ່ານັ້ນ' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session ໝົດອາຍຸ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່' });
  }
}

module.exports = requireAuth;
module.exports.requireOwner = requireOwner;