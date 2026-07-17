# NetPulse Server — 24/7 Website Uptime Monitor

Ye ek Node.js/Express server hai jo background me har `CHECK_INTERVAL_MS`
(default: 60 second) par saari monitored websites ko check karta hai —
kisi browser tab ya user ke online hone ki zaroorat nahi. Data
`data/sites.json` file me save hota hai.

## Local pe test karna

```
npm install
npm start
```

Phir browser me kholo: `http://localhost:3000`

## Deploy karna (24/7 online rakhne ke liye)

Isse genuinely 24/7 chalane ke liye kisi hosting service pe deploy karna
hoga. Do achhe options:

### Option A — Render.com

1. Is folder ko GitHub repo me push karo.
2. [render.com](https://render.com) pe "New Web Service" banao, apna repo
   connect karo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy hote hi ek public URL milega (jaise `https://netpulse-xyz.onrender.com`).

**⚠️ Important caveat (Render free tier):** free web services 15 minute
tak koi traffic na aane par **sleep** ho jaate hain — jab tak koi request
na aaye, background checks bhi ruk jaate hain. Genuinely 24/7 continuous
monitoring ke liye Render ka **paid tier** ($7/month se) chahiye hoga,
jo sleep nahi karta.

### Option B — Railway.app

Similar process — repo connect karo, deploy karo. Railway ka free trial
credit-based hai; usके baad paid plan chahiye hoga continuous uptime ke liye.

### Option C — Apna VPS (DigitalOcean, Hetzner, etc.)

Sabse reliable & sabse sasta long-term — ek chhota VPS (~$4-6/month) lo,
Node.js install karo, aur `pm2` se app ko background me hamesha chalne
wala process bana do:

```
npm install -g pm2
pm2 start server.js --name netpulse
pm2 save
pm2 startup
```

## Environment variables (optional)

- `PORT` — server kis port pe chale (default: 3000, hosting platforms
  usually apna khud set karte hain)
- `CHECK_INTERVAL_MS` — kitni der me sab sites recheck ho (default: 60000 = 1 min)
- `CHECK_TIMEOUT_MS` — har check attempt ka timeout (default: 10000 = 10 sec)

## Data persistence note

`data/sites.json` file-based storage hai — simple aur zero-setup ke liye
theek hai. Lekin kuch hosting platforms (jaise Render free tier) ka
filesystem **ephemeral** hota hai — matlab naya deploy hone par history
reset ho sakti hai. Agar long-term history important hai (customer ko
bech rahe ho), to future me isko SQLite ya Postgres database me
upgrade karna better hoga — abhi ke liye JSON file testing/MVP ke liye
kaafi hai.

## API endpoints

- `GET /api/sites` — sab sites aur unka status/history
- `POST /api/sites` — `{ "url": "example.com" }` — nayi site add karo
- `DELETE /api/sites/:id` — site remove karo
- `POST /api/sites/:id/recheck` — manually turant recheck karo
- `DELETE /api/sites/:id/history` — us site ki history clear karo
