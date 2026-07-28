const { google } = require('googleapis');

// ---- Auth: uses a Google Service Account (see README for setup) ----
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || './service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

/**
 * Expected spreadsheet structure (tabs):
 *
 * "Users" tab, columns: A=username | B=password_hash | C=whatsapp_number | D=role
 * "Routes" tab, columns: A=from_region | B=to_region | C=stop1 | D=stop2 | E=stop3 | F=stop4
 * "Rides"  tab, columns: A=ride_id | B=date | C=passenger_name | D=from | E=to
 *                          F=stops | G=price | H=driver_name | I=plate | J=car_model
 *                          K=car_color | L=driver_phone | M=payment_method | N=whatsapp_sent
 */

async function getAllRows(tabName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A2:Z`,
  });
  return res.data.values || [];
}

async function appendRow(tabName, rowValues) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });
}

async function updateCell(tabName, rowNumber, columnLetter, value) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!${columnLetter}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

// ---- Users ----
async function findUserByUsername(username) {
  const rows = await getAllRows('Users');
  const idx = rows.findIndex(r => (r[0] || '').toLowerCase() === username.toLowerCase());
  if (idx === -1) return null;
  const r = rows[idx];
  return {
    rowNumber: idx + 2, // +2 because data starts at row 2
    username: r[0],
    passwordHash: r[1],
    whatsappNumber: r[2],
    role: r[3] || 'staff',
  };
}

async function setUserPasswordHash(rowNumber, newHash) {
  await updateCell('Users', rowNumber, 'B', newHash);
}

// ---- Routes (for auto-calculated stops) ----
async function findRouteStops(fromRegion, toRegion) {
  const rows = await getAllRows('Routes');
  const match = rows.find(
    r => (r[0] || '').toLowerCase() === fromRegion.toLowerCase() &&
         (r[1] || '').toLowerCase() === toRegion.toLowerCase()
  );
  if (!match) return [];
  return match.slice(2).filter(Boolean);
}

async function upsertRouteStops(fromRegion, toRegion, stops) {
  const sheets = await getSheetsClient();
  const rows = await getAllRows('Routes');
  const idx = rows.findIndex(
    r => (r[0] || '').toLowerCase() === fromRegion.toLowerCase() &&
         (r[1] || '').toLowerCase() === toRegion.toLowerCase()
  );
  const rowValues = [fromRegion, toRegion, ...stops];
  if (idx === -1) {
    await appendRow('Routes', rowValues);
  } else {
    const rowNumber = idx + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Routes!A${rowNumber}:F${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] },
    });
  }
}

// ---- Rides ----
async function saveRide(ride) {
  await appendRow('Rides', [
    ride.rideId, ride.date, ride.passengerName, ride.from, ride.to,
    ride.stops.join(' | '), ride.price, ride.driverName, ride.plate,
    ride.carModel, ride.carColor, ride.driverPhone, ride.paymentMethod, 'no',
  ]);
}

module.exports = {
  findUserByUsername,
  setUserPasswordHash,
  findRouteStops,
  upsertRouteStops,
  saveRide,
  getAllRows,
};
