// NetPulse Server — 24/7 website uptime monitor
// Runs checks in the background on an interval, independent of any browser tab.
// Data is stored in a local JSON file (data/sites.json).

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'sites.json');
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS || '15000', 10); // default: every 1 min
const CHECK_TIMEOUT_MS = parseInt(process.env.CHECK_TIMEOUT_MS || '10000', 10);   // default: 10s per attempt
const RETRY_DELAY_MS = 1200;
const MAX_HISTORY = 500;

function newId(){
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '_' + Math.random().toString(36).slice(2));
}

function loadData(){
  try{
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }catch(e){
    return { sites: [] };
  }
}

function saveData(data){
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

function normalizeUrl(raw){
  let u = String(raw || '').trim();
  if(!u) return null;
  if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try{ new URL(u); return u; }catch(e){ return null; }
}

// A single HTTP check attempt with a timeout. Uses a real HTTP request
// (not ICMP — Node can't send raw ICMP without OS-level privileges either),
// which is exactly what real uptime tools like UptimeRobot/Pingdom do too.
async function attempt(url, timeoutMs){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try{
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    // Treat 5xx as down (server-side failure); anything else that responds counts as up.
    return { ok: res.status < 500, statusCode: res.status, ms: Date.now() - start };
  }catch(e){
    clearTimeout(timer);
    return { ok: false, statusCode: null, ms: null };
  }
}

// One retry before declaring "down" — avoids false alarms from transient blips.
async function checkSite(site){
  let result = await attempt(site.url, CHECK_TIMEOUT_MS);
  if(!result.ok){
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    result = await attempt(site.url, CHECK_TIMEOUT_MS);
  }
  const status = result.ok ? 'up' : 'down';
  site.status = status;
  site.ms = result.ms;
  site.statusCode = result.statusCode;
  site.lastCheckedAt = Date.now();
  site.history = site.history || [];
  site.history.push({ ts: Date.now(), status, ms: result.ms });
  if(site.history.length > MAX_HISTORY) site.history = site.history.slice(-MAX_HISTORY);
  return site;
}

async function runAllChecks(){
  for(const site of db.sites){
    try{ await checkSite(site); }catch(e){ /* keep going even if one site errors */ }
  }
  saveData(db);
}

// Kick off immediately on boot, then repeat forever on the interval —
// this is what makes monitoring continue with no browser tab open at all.
runAllChecks();
setInterval(runAllChecks, CHECK_INTERVAL_MS);

/* ---------------- API ---------------- */

app.get('/api/sites', (req, res) => {
  res.json({ sites: db.sites, checkIntervalMs: CHECK_INTERVAL_MS });
});

app.post('/api/sites', async (req, res) => {
  const url = normalizeUrl(req.body && req.body.url);
  if(!url) return res.status(400).json({ error: 'valid url required' });
  const site = { id: newId(), url, status: 'checking', ms: null, statusCode: null, history: [] };
  db.sites.push(site);
  saveData(db);
  await checkSite(site);
  saveData(db);
  res.json(site);
});

app.delete('/api/sites/:id', (req, res) => {
  const before = db.sites.length;
  db.sites = db.sites.filter(s => s.id !== req.params.id);
  saveData(db);
  res.json({ ok: true, removed: before - db.sites.length });
});

app.post('/api/sites/:id/recheck', async (req, res) => {
  const site = db.sites.find(s => s.id === req.params.id);
  if(!site) return res.status(404).json({ error: 'not found' });
  await checkSite(site);
  saveData(db);
  res.json(site);
});

app.delete('/api/sites/:id/history', (req, res) => {
  const site = db.sites.find(s => s.id === req.params.id);
  if(!site) return res.status(404).json({ error: 'not found' });
  site.history = [];
  saveData(db);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NetPulse server running on port ${PORT}`);
  console.log(`Checking all sites every ${CHECK_INTERVAL_MS / 1000}s, ${CHECK_TIMEOUT_MS / 1000}s timeout per attempt.`);
});
