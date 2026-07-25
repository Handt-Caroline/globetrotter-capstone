// auth.routes.js
// Handles user registration and login for the GlobeTrotter app.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDB, writeDB } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /auth/register — create a new real user account
router.post('/register', async (req, res) => {
  const { name, email, phone, password, preferences } = req.body;

  // Basic validation — reject incomplete submissions
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const db = readDB();

  // Prevent two accounts sharing the same email
  const alreadyExists = db.users.find((u) => u.email === email);
  if (alreadyExists) {
    return res.status(409).json({ error: 'This email is already registered' });
  }

  // NEVER store plain text passwords — always hash them first
  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = {
    id: 'u' + Date.now(),
    name,
    email,
    phone: phone || '',
    passwordHash,
    // preferences are category strings (e.g. "culture", "nature") used later
    // by GET /recommendations to personalise results
    preferences: Array.isArray(preferences) ? preferences : [],
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  await writeDB(db);

  res.status(201).json({ message: 'Registered successfully', userId: newUser.id });
});

// POST /auth/login — verify credentials and issue a login token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const db = readDB();
  const user = db.users.find((u) => u.email === email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Token proves this user is logged in — valid for 7 days
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({ message: 'Login successful', token, userId: user.id, name: user.name });
});

// PUT /auth/preferences — logged-in user updates their travel preferences
// (category tags like "culture", "nature", "history"). Used by /recommendations.
router.put('/preferences', authMiddleware, async (req, res) => {
  const { preferences } = req.body;

  if (!Array.isArray(preferences)) {
    return res.status(400).json({ error: 'preferences must be an array of strings' });
  }

  const db = readDB();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.preferences = preferences;
  await writeDB(db);

  res.json({ message: 'Preferences updated', preferences: user.preferences });
});

module.exports = router;