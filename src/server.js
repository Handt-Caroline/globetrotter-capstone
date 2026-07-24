require('dotenv').config();
const express = require('express');
const { readDB } = require('./db');
const authRoutes = require('./routes/auth.routes');
const sitesRoutes = require('./routes/sites.routes');
const itinerariesRoutes = require('./routes/itineraries.routes');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  const db = readDB();
  res.json({
    message: 'GlobeTrotter API is running',
    totalSites: db.sites.length,
  });
});

app.use('/auth', authRoutes);
app.use('/sites', sitesRoutes);
app.use('/itineraries', itinerariesRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));