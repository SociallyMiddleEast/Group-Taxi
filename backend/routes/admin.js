const express = require('express');
const sheets = require('../services/googleSheets');
const stopsService = require('../services/stops');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---- GET /api/admin/regions ----
router.get('/regions', (req, res) => {
  res.json(stopsService.getAllRegionsAndCities());
});

// ---- POST /api/admin/routes ----
// Body: { from, to, stops: [ ... up to 4 stop names ... ] }
// Lets Miguel define/override the automatic stops used for a given From -> To pair.
router.post('/routes', async (req, res) => {
  try {
    const { from, to, stops } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
    await sheets.upsertRouteStops(from, to, (stops || []).slice(0, 4));
    res.json({ message: `Route ${from} -> ${to} saved` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save route' });
  }
});

// ---- GET /api/admin/routes ----
// Lists all currently configured routes, for the settings screen.
router.get('/routes', async (req, res) => {
  try {
    const rows = await sheets.getAllRows('Routes');
    const routes = rows.map(r => ({
      from: r[0], to: r[1], stops: r.slice(2).filter(Boolean),
    }));
    res.json({ routes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load routes' });
  }
});

module.exports = router;
