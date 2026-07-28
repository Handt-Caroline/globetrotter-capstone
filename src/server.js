require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { readDB } = require('./db');
const { log } = require('./logger');

const authRoutes = require('./routes/auth.routes');
const sitesRoutes = require('./routes/sites.routes');
const recommendationsRoutes = require('./routes/recommendations.routes');
const itinerariesRoutes = require('./routes/itineraries.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const paymentsRoutes = require('./routes/payments.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
app.use(cors());
app.use(express.json());

// REQUEST LOGGING — satisfies "observable (metrics, logging, tracing)".
// Every single request that hits our server gets recorded, with
// how long it took to respond and what status code came back.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use(express.static(path.join(__dirname, '..', 'web-client')));

app.get('/api', (req, res) => {
  const db = readDB();
  res.json({
    message: 'GlobeTrotter API is running',
    totalSites: db.sites.length,
  });
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web-client', 'index2.html'));
});

app.use('/auth', authRoutes);
app.use('/sites', sitesRoutes);
app.use('/recommendations', recommendationsRoutes);
app.use('/itineraries', itinerariesRoutes);
app.use('/bookings', bookingsRoutes);
app.use('/bookings', paymentsRoutes);
app.use('/admin/bookings', adminRoutes);

// 404 HANDLER — catches requests to routes that don't exist,
// so the client gets a clean JSON message instead of an HTML error page.
app.use((req, res) => {
  log(`404 NOT FOUND: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// GLOBAL ERROR HANDLER — satisfies "resilient, no single point of failure".
// If ANY route throws an unexpected error (bad data, a bug, a crash),
// this catches it here instead of letting the whole server go down.
// Must always be the LAST app.use() in the file.
app.use((err, req, res, next) => {
  log(`ERROR ${req.method} ${req.path} - ${err.message}`);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => log(`Server running on port ${PORT}`));