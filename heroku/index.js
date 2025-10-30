/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * Licensed under the license found in the LICENSE file in the root directory.
 */

const express = require('express');
const bodyParser = require('body-parser');
const xhub = require('express-x-hub');

const app = express();

// ---- Config
const PORT = process.env.PORT || 5000;
const APP_SECRET = process.env.APP_SECRET;
const VERIFY_TOKEN = process.env.TOKEN || 'token';

let received_updates = [];

// ---- Startup logs
console.log('[BOOT] Starting server…');
console.log('[BOOT] PORT =', PORT);
console.log('[BOOT] APP_SECRET set =', !!APP_SECRET);
console.log('[BOOT] VERIFY_TOKEN =', VERIFY_TOKEN);

app.set('port', (process.env.PORT || 5000)); app.listen(app.get('port')); app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET })); app.use(bodyParser.json());
// ---- Trust proxy (useful if behind ngrok/Heroku)
app.set('trust proxy', true);

// ---- Capture raw body for signature debugging
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
    limit: '2mb',
  })
);

// ---- X-Hub signature validator (leave enabled even if you don’t enforce)
app.use(
  xhub({
    algorithm: 'sha1',
    secret: APP_SECRET || 'missing-app-secret',
  })
);

// ---- Request logger (everything)
app.use((req, res, next) => {
  const start = Date.now();
  const rid = Math.random().toString(36).slice(2, 8);

  console.log('\n===================================================');
  console.log([REQ ${rid}] ${req.ip} ${req.method} ${req.originalUrl});
  console.log([REQ ${rid}] Query:, req.query);
  console.log([REQ ${rid}] Headers:, req.headers);

  if (req.rawBody) {
    console.log(
      [REQ ${rid}] RawBody(${req.rawBody.length} bytes):,
      req.rawBody.toString('utf8')
    );
  } else {
    console.log([REQ ${rid}] RawBody: <none>);
  }

  // On response finish, print status + duration
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(
      [RES ${rid}] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${ms}ms
    );
    console.log('===================================================\n');
  });

  next();
});

// ---- Basic index to see what we stored
app.get('/', (req, res) => {
  console.log('[GET /] Sending received_updates snapshot (count:', received_updates.length, ')');
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

// ---- Verification endpoints (GET)
app.get(['/facebook', '/instagram', '/threads'], (req, res) => {
  const { ['hub.mode']: mode, ['hub.verify_token']: token, ['hub.challenge']: challenge } = req.query;

  console.log('[VERIFY] mode =', mode);
  console.log('[VERIFY] verify_token (incoming) =', token);
  console.log('[VERIFY] verify_token (expected) =', VERIFY_TOKEN);
  console.log('[VERIFY] challenge =', challenge);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[VERIFY] OK – responding with challenge');
    res.status(200).send(challenge);
  } else {
    console.log('[VERIFY] FAILED – wrong mode or token');
    res.sendStatus(400);
  }
});

// ---- POST: Facebook
app.post('/facebook', (req, res) => {
  console.log('[POST /facebook] Body:', req.body);
  console.log('[POST /facebook] x-hub-signature:', req.get('x-hub-signature') || '<none>');

  // If you want to enforce signature validity, uncomment:
  // if (!req.isXHubValid()) {
  //   console.log('[POST /facebook] ❌ Invalid X-Hub signature');
  //   return res.sendStatus(401);
  // }

  console.log('[POST /facebook] ✅ Request accepted');
  received_updates.unshift({ source: 'facebook', at: new Date().toISOString(), body: req.body });
  res.sendStatus(200);
});

// ---- POST: Instagram
app.post('/instagram', (req, res) => {
  console.log('[POST /instagram] Body:', req.body);
  console.log('[POST /instagram] x-hub-signature:', req.get('x-hub-signature') || '<none>');
  received_updates.unshift({ source: 'instagram', at: new Date().toISOString(), body: req.body });
  res.sendStatus(200);
});

// ---- POST: Threads
app.post('/threads', (req, res) => {
  console.log('[POST /threads] Body:', req.body);
  console.log('[POST /threads] x-hub-signature:', req.get('x-hub-signature') || '<none>');
  received_updates.unshift({ source: 'threads', at: new Date().toISOString(), body: req.body });
  res.sendStatus(200);
});

// ---- 404 logger (hits if Meta POSTs a different path than you expect)
app.use((req, res, next) => {
  console.log('[404] No route matched:', req.method, req.originalUrl);
  res.status(404).send('Not found');
});

// ---- Error handler (JSON parse, etc.)
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err);
  res.status(500).send('Server error');
});

// ---- Single listen (don’t call app.listen twice)
app.listen(PORT, () => {
  console.log([BOOT] Listening on http://0.0.0.0:${PORT});
  console.log('[BOOT] Ready to receive GET verification and POST webhooks.');
});
