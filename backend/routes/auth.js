const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sheets = require('../services/googleSheets');
const whatsapp = require('../services/whatsapp');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// In-memory OTP store: { username: { code, expiresAt } }
// For a small single-instance deployment this is fine; move to Redis if you scale to multiple servers.
const otpStore = new Map();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ---- POST /api/auth/login ----
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await sheets.findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ---- POST /api/auth/forgot-password ----
// Sends a one-time code over WhatsApp, but ONLY to the number already on file for that
// username in the Google Sheet - never to a number supplied by the request.
router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = await sheets.findUserByUsername(username);
    // Respond the same way whether or not the user exists, so requests can't be used
    // to check which usernames exist.
    if (!user || !user.whatsappNumber) {
      return res.json({ message: 'If that account exists, a reset code has been sent.' });
    }

    const code = generateOtp();
    otpStore.set(username.toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    await whatsapp.sendOtp(user.whatsappNumber, code);
    res.json({ message: 'If that account exists, a reset code has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send reset code' });
  }
});

// ---- POST /api/auth/reset-password ----
router.post('/reset-password', async (req, res) => {
  try {
    const { username, code, newPassword } = req.body;
    if (!username || !code || !newPassword) {
      return res.status(400).json({ error: 'Username, code, and new password required' });
    }

    const entry = otpStore.get(username.toLowerCase());
    if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    const user = await sheets.findUserByUsername(username);
    if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await sheets.setUserPasswordHash(user.rowNumber, newHash);
    otpStore.delete(username.toLowerCase());

    res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

module.exports = router;
