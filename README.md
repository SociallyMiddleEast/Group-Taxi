# GroupTaxi App - Setup Guide

This app has two parts:
- **backend/** - a Node.js server that talks to Google Sheets and Twilio WhatsApp. This is where all secrets live.
- **frontend/** - a single mobile-friendly web page (`index.html`) that drivers/staff open on their phone.

Nothing sensitive (API keys, admin password, service account) is ever in the frontend file - it only talks to your backend over the network.

---

## 1. Set up the Google Sheet

Create a new Google Sheet with **three tabs**, named exactly:

### Tab "Users"
| A (username) | B (password_hash) | C (whatsapp_number) | D (role) |
|---|---|---|---|
| Miguel | *(generated hash, see below)* | 96170149111 | admin |
| wael | *(generated hash)* | 96170149112 | staff |

- Never type a plain password into column B - always generate a hash first (step 4 below).
- Column C is the number the forgot-password code gets sent to. It must match the number for that user - this is how "reset only works if the number matches" is enforced.

### Tab "Routes"
| A (from_region) | B (to_region) | C (stop1) | D (stop2) | E (stop3) | F (stop4) |
|---|---|---|---|---|---|
| Beirut | Bekaa | Dahr el Baidar | Chtaura | | |

- You don't need to fill this in advance - Miguel can add routes from the Settings screen in the app once it's running.

### Tab "Rides"
Leave this **empty except for a header row** - the app fills it in automatically every time a ride is saved:
`ride_id | date | passenger_name | from | to | stops | price | driver_name | plate | car_model | car_color | driver_phone | payment_method | whatsapp_sent`

Copy the Sheet's ID from its URL:
`https://docs.google.com/spreadsheets/d/`**`THIS_PART_IS_THE_ID`**`/edit`

---

## 2. Create a Google Service Account (so the backend can read/write the Sheet)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (e.g. "GroupTaxi").
2. In the search bar, find **"Google Sheets API"** and click **Enable**.
3. Go to **APIs & Services -> Credentials -> Create Credentials -> Service Account**.
4. Give it any name (e.g. `grouptaxi-backend`), skip the optional permission steps, click **Done**.
5. Click into the new service account -> **Keys** tab -> **Add Key -> Create new key -> JSON**. This downloads a `.json` file.
6. Rename that file to `service-account.json` and place it inside the `backend/` folder.
7. Open the JSON file and copy the `client_email` value (looks like `grouptaxi-backend@your-project.iam.gserviceaccount.com`).
8. Open your Google Sheet, click **Share**, and share it with that email address as an **Editor**.

---

## 3. Set up Twilio WhatsApp (recommended for you to start with)

1. Create a free account at [twilio.com](https://www.twilio.com).
2. In the Console, go to **Messaging -> Try it out -> Send a WhatsApp message**. This gives you a sandbox WhatsApp number and a join code.
3. From your own WhatsApp, send the join code to that sandbox number (needed once, to opt in for testing).
4. Copy your **Account SID** and **Auth Token** from the Twilio Console dashboard.
5. Later, when you're ready to send real customer messages (not just to your own test number), apply for a Twilio-approved **WhatsApp Business Sender** using your company's own phone number - Twilio's dashboard walks you through this ("Senders -> WhatsApp senders").

---

## 4. Generate password hashes for your users

```bash
cd backend
npm install
node hash-password.js "Miguel'sRealPassword"
```

This prints a hash - paste that into column B of the Users tab (never the real password).

The Miguel admin account note: you gave the password `D0022b0c0cf53@$` in your request - please treat that as compromised now that it's been typed out, and generate a fresh one with the command above before going live.

---

## 5. Configure and run the backend

```bash
cd backend
cp .env.example .env
# edit .env: fill in SPREADSHEET_ID, JWT_SECRET (any long random string),
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
npm install
npm start
```

It runs on `http://localhost:3000` by default. Test it's alive:
```bash
curl http://localhost:3000/api/health
```

For real phone use, deploy this backend somewhere reachable over the internet - Railway, Render, or a small VPS all work well and are inexpensive for this size of app.

---

## 6. Run the frontend

Open `frontend/index.html`'s top of the `<script>` tag and change:
```js
: 'https://YOUR-BACKEND-DOMAIN.example.com/api';
```
to your deployed backend's actual URL.

Then host `index.html` anywhere static (Netlify, Vercel, GitHub Pages, or even your own server) - drivers/staff just open that link on their phone.

---

## How each of your requirements is implemented

- **Google Sheets connection**: `backend/services/googleSheets.js`
- **Login by username/password from the sheet**: `backend/routes/auth.js` (`/login`), passwords stored as bcrypt hashes, never plaintext
- **Forgot password via WhatsApp, only if the number matches**: `/forgot-password` looks up the WhatsApp number already on file for that username in the sheet and sends the code only there - a request can never redirect a code to a different number
- **From/To with automatically calculated stops, editable from Settings**: `backend/services/stops.js` + `Routes` tab; Settings screen posts to `/api/admin/routes`
- **Settings restricted to Miguel**: enforced server-side in `backend/middleware/auth.js` (`requireAdmin`) - this can't be bypassed by editing the front-end page, since the check happens on the server
- **Send receipt via WhatsApp, matching your template**: `backend/services/whatsapp.js` (`buildReceiptMessage`) mirrors your attached receipt's fields (ride details, driver info, payment, total)
- **All Lebanon regions**: `backend/config/lebanonRegions.json` - edit this file to add/rename any city or region
