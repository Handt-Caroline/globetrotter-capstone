// payments.routes.js
// Handles the MANUAL MoMo / Orange Money payment flow:
// 1. User sends real money to the admin's personal MoMo/OM number (outside the app)
// 2. User receives an SMS confirmation with a transaction reference code
// 3. User submits that reference code here, into the app
// 4. Booking status becomes "pending_verification" until an admin confirms it

const express = require('express');
const { readDB, writeDB } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /bookings/:bookingId/submit-payment
router.post('/:bookingId/submit-payment', authMiddleware, async (req, res) => {
  const { momoReference, phoneUsed, provider } = req.body;

  if (!momoReference || !phoneUsed || !provider) {
    return res.status(400).json({ error: 'momoReference, phoneUsed, and provider are required' });
  }

  if (provider !== 'momo' && provider !== 'orange') {
    return res.status(400).json({ error: 'provider must be either "momo" or "orange"' });
  }

  const db = readDB();
  const booking = db.bookings.find(
    (b) => b.id === req.params.bookingId && b.userId === req.userId
  );
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const payment = {
    id: 'p' + Date.now(),
    bookingId: booking.id,
    provider,          // "momo" or "orange" — which service the user actually paid with
    momoReference,     // the transaction reference code (name kept generic for both providers)
    phoneUsed,
    status: 'pending_verification', // admin must confirm this manually
    verifiedAt: null,
  };
  db.payments.push(payment);
  booking.status = 'pending_verification';
  await writeDB(db);

  res.status(201).json({
    message: 'Payment submitted. It will be verified shortly.',
    payment,
  });
});

module.exports = router;