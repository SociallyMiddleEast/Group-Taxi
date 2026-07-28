const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// Settings/admin access is restricted to the single backend-configured admin account
// (username 'Miguel'). This check happens ONLY here, server-side - it is never sent
// to or checked by the browser, so it can't be read out of the app's front-end code.
function requireAdmin(req, res, next) {
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  if (!req.user || req.user.username !== ADMIN_USERNAME) {
    return res.status(403).json({ error: 'Settings are restricted to the admin account' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
