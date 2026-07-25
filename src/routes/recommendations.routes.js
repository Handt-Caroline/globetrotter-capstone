// recommendations.routes.js
// GET /recommendations — personalised site suggestions for the logged-in user.
//
// Logic:
// 1. If the user has saved preferences (category tags like "culture", "nature"),
//    recommend sites matching those categories first.
// 2. Sites the user has already booked are pushed to the bottom (already been there).
// 3. If the user has no preferences yet (or nothing matches), fall back to the
//    catalogue's most-commented sites — a simple "popular with other travellers" signal.
// 4. Each result includes a `reason` field so the client can explain *why* it was suggested.

const express = require('express');
const { readDB } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const alreadyBookedSiteIds = new Set(
    db.bookings.filter((b) => b.userId === req.userId).map((b) => b.siteId)
  );

  const preferences = (user.preferences || []).map((p) => p.toLowerCase());

  const scored = db.sites.map((site) => {
    const matchesPreference = preferences.includes(site.category.toLowerCase());
    const alreadyBooked = alreadyBookedSiteIds.has(site.id);
    return {
      ...site,
      score: (matchesPreference ? 2 : 0) + site.comments.length * 0.1 - (alreadyBooked ? 5 : 0),
      reason: matchesPreference
        ? `Matches your interest in "${site.category}"`
        : 'Popular with other travellers',
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const recommendations = scored.slice(0, 10).map(({ score, ...site }) => site);

  res.json({
    basedOnPreferences: preferences.length > 0,
    preferences,
    recommendations,
  });
});

module.exports = router;
