// sites.routes.js
// Lets anyone browse tourist sites in Yaoundé, and lets logged-in
// users leave comments on a site.

const express = require('express');
const { readDB, writeDB } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /sites — browse all sites, with optional search and category filter
// Examples: /sites?search=zoo   or   /sites?category=culture
router.get('/', (req, res) => {
  const { category, search } = req.query;
  const db = readDB();
  let sites = db.sites;

  if (category) {
    sites = sites.filter((s) => s.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    sites = sites.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }

  res.json(sites);
});

// GET /sites/:id — view one site's full details, including its comments
router.get('/:id', (req, res) => {
  const db = readDB();
  const site = db.sites.find((s) => s.id === req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(site);
});

// POST /sites/:id/comments — a logged-in user leaves a comment on a site
router.post('/:id/comments', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const db = readDB();
  const site = db.sites.find((s) => s.id === req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  // Look up the commenting user's name to display next to their comment
  const user = db.users.find((u) => u.id === req.userId);

  const newComment = {
    id: 'c' + Date.now(),
    userId: req.userId,
    userName: user ? user.name : 'Unknown',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  site.comments.push(newComment);
  await writeDB(db);

  res.status(201).json(newComment);
});

module.exports = router;