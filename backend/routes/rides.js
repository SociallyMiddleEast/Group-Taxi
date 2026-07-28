const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sheets = require('../services/googleSheets');
const stopsService = require('../services/stops');
const whatsapp = require('../services/whatsapp');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ---- GET /api/rides/regions ----
// Returns all Lebanon regions and their cities, for the From/To pickers.
router.get('/regions', (req, res) => {
  res.json(stopsService.getAllRegionsAndCities());
});

// ---- GET /api/rides/auto-stops?from=X&to=Y ----
router.get('/auto-stops', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
    const autoStops = await stopsService.getAutoStops(from, to);
    res.json({ stops: autoStops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not calculate stops' });
  }
});

// ---- POST /api/rides ----
// Creates a ride record in the Rides sheet tab.
router.post('/', async (req, res) => {
  try {
    const {
      passengerName, from, to, stops, price,
      driverName, plate, carModel, carColor, driverPhone, paymentMethod,
    } = req.body;

    if (!passengerName || !from || !to || !price) {
      return res.status(400).json({ error: 'passengerName, from, to, and price are required' });
    }

    const ride = {
      rideId: uuidv4(),
      date: new Date().toLocaleDateString('en-GB'),
      passengerName, from, to,
      stops: stops || [],
      price, driverName, plate, carModel, carColor, driverPhone,
      paymentMethod: paymentMethod || 'Cash',
    };

    await sheets.saveRide(ride);
    res.json({ ride });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save ride' });
  }
});

// ---- POST /api/rides/send-receipt ----
// Sends the receipt to the passenger's WhatsApp number.
router.post('/send-receipt', async (req, res) => {
  try {
    const { passengerWhatsapp, ride } = req.body;
    if (!passengerWhatsapp || !ride) {
      return res.status(400).json({ error: 'passengerWhatsapp and ride are required' });
    }
    await whatsapp.sendReceipt(passengerWhatsapp, ride);
    res.json({ message: 'Receipt sent on WhatsApp' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send receipt' });
  }
});

module.exports = router;
