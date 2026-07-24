// bookings.routes.js
// Lets a logged-in user create a booking for a site, and view their
// own bookings. The price comes from the site itself (not the client),
// so it can't be tampered with. When a booking is created, the response
// includes both MoMo and Orange Money numbers so the user can pay with
// whichever provider they actually use.

const express = require('express');
const { readDB, writeDB } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware); // every route here requires login

// POST /bookings — create a new booking for a site
router.post('/', async (req, res) => {
  const { siteId } = req.body;
  if (!siteId) return res.status(400).json({ error: 'siteId is required' });

  const db = readDB();
  const site = db.sites.find((s) => s.id === siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const newBooking = {
    id: 'b' + Date.now(),
    userId: req.userId,
    siteId,
    amount: site.price,       // pulled from the site, not the client — prevents tampering
    status: 'pending',        // will change as payment progresses
    createdAt: new Date().toISOString(),
  };

  db.bookings.push(newBooking);
  await writeDB(db);

  // Send back the booking AND both payment numbers.
  // The user picks whichever provider they actually use (MoMo or Orange Money).
  res.status(201).json({
    ...newBooking,
    paymentInstructions: {
      amount: newBooking.amount,
      momoNumber: process.env.ADMIN_MOMO_NUMBER,
      orangeNumber: process.env.ADMIN_ORANGE_NUMBER,
      note: 'Send this amount via MTN MoMo or Orange Money to the matching number above, then submit the transaction reference you receive by SMS.',
    },
  });
});

// GET /bookings — view only MY bookings
router.get('/', (req, res) => {
  const db = readDB();
  const mine = db.bookings.filter((b) => b.userId === req.userId);
  res.json(mine);
});

// GET /bookings/:id — view one of MY bookings in detail
router.get('/:id', (req, res) => {
  const db = readDB();
  const booking = db.bookings.find(
    (b) => b.id === req.params.id && b.userId === req.userId
  );
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
});

module.exports = router;