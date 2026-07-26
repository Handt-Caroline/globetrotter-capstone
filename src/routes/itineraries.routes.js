// itineraries.routes.js
// Lets a logged-in user create and manage their own travel itineraries,
// and lets ANYONE (even without an account) view a shared itinerary
// via a public read-only link — satisfies "share itineraries with
// friends and family."

const express = require('express');
const { readDB, writeDB } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /itineraries/:id/share — PUBLIC route, placed BEFORE authMiddleware
// on purpose. A friend or family member without an account can open
// this link and see the itinerary and its sites, read-only.
router.get('/:id/share', (req, res) => {
  const db = readDB();
  const itinerary = db.itineraries.find((it) => it.id === req.params.id);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

  const sites = db.sites.filter((s) => itinerary.siteIds.includes(s.id));
  res.json({ ...itinerary, sites });
});

// Everything below this line requires the user to be logged in.
router.use(authMiddleware);

// POST /itineraries — create a new itinerary
router.post('/', async (req, res) => {
  const { title, startDate, endDate, siteIds } = req.body;

  if (!title || !startDate || !endDate) {
    return res.status(400).json({ error: 'title, startDate and endDate are required' });
  }

  const db = readDB();
  const newItinerary = {
    id: 'it' + Date.now(),
    userId: req.userId,
    title,
    startDate,
    endDate,
    siteIds: siteIds || [],
  };

  db.itineraries.push(newItinerary);
  await writeDB(db);

  res.status(201).json(newItinerary);
});

// GET /itineraries — view only MY itineraries
router.get('/', (req, res) => {
  const db = readDB();
  const mine = db.itineraries.filter((it) => it.userId === req.userId);
  res.json(mine);
});

// GET /itineraries/:id — view one of MY itineraries in detail
router.get('/:id', (req, res) => {
  const db = readDB();
  const itinerary = db.itineraries.find(
    (it) => it.id === req.params.id && it.userId === req.userId
  );
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  res.json(itinerary);
});

// PUT /itineraries/:id/sites — add a site to an existing itinerary
router.put('/:id/sites', async (req, res) => {
  const { siteId } = req.body;
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });

  const db = readDB();
  const itinerary = db.itineraries.find(
    (it) => it.id === req.params.id && it.userId === req.userId
  );
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

  if (!itinerary.siteIds.includes(siteId)) {
    itinerary.siteIds.push(siteId);
  }
  await writeDB(db);

  res.json(itinerary);
});

module.exports = router;