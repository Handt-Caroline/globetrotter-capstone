// admin.routes.js
// Lets the admin (you) confirm that a payment genuinely arrived,
// after checking your own MoMo/Orange Money SMS confirmation.
// Protected by a secret key instead of a full login system.

const express = require('express');
const { readDB, writeDB } = require('../db');

const router = express.Router();

// POST /admin/bookings/:bookingId/verify
router.post('/:bookingId/verify', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const db = readDB();
  const booking = db.bookings.find((b) => b.id === req.params.bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const payment = db.payments.find((p) => p.bookingId === booking.id);
  if (!payment) return res.status(404).json({ error: 'No payment submitted for this booking' });

  payment.status = 'confirmed';
  payment.verifiedAt = new Date().toISOString();
  booking.status = 'confirmed';

  await writeDB(db);

  res.json({ message: 'Payment verified, booking confirmed', booking, payment });
});

module.exports = router;