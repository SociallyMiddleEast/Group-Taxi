const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886' (sandbox) or your approved number

// Normalizes a Lebanese number to E.164, e.g. "70 149 111" or "03149111" -> "+96170149111"
function normalizeLebanonNumber(raw) {
  let digits = String(raw).replace(/[^\d]/g, '');
  if (digits.startsWith('961')) return `+${digits}`;
  if (digits.startsWith('0')) digits = digits.slice(1);
  return `+961${digits}`;
}

async function sendWhatsAppMessage(toRawNumber, body) {
  const to = `whatsapp:${normalizeLebanonNumber(toRawNumber)}`;
  return client.messages.create({ from: FROM, to, body });
}

async function sendOtp(toRawNumber, code) {
  const body = `GroupTaxi password reset code: ${code}\nThis code expires in 10 minutes. If you didn't request this, ignore this message.`;
  return sendWhatsAppMessage(toRawNumber, body);
}

function buildReceiptMessage(ride) {
  return [
    `*GROUP TAXI - Ride Receipt*`,
    `Date: ${ride.date}`,
    ``,
    `Passenger: ${ride.passengerName}`,
    `From: ${ride.from}`,
    `To: ${ride.to}`,
    ride.stops.length ? `Stops: ${ride.stops.join(', ')}` : null,
    ``,
    `Total: ${ride.price} USD`,
    ``,
    `--- Ride Info ---`,
    `Driver: ${ride.driverName}`,
    `Plate: ${ride.plate}`,
    `Car: ${ride.carModel} (${ride.carColor})`,
    `Driver phone: ${ride.driverPhone}`,
    ``,
    `Payment: ${ride.paymentMethod}`,
    ``,
    `Thank you for riding with GroupTaxi.`,
  ].filter(Boolean).join('\n');
}

async function sendReceipt(toRawNumber, ride) {
  const body = buildReceiptMessage(ride);
  return sendWhatsAppMessage(toRawNumber, body);
}

module.exports = { sendOtp, sendReceipt, sendWhatsAppMessage, normalizeLebanonNumber };
