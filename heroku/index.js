/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var xhub = require('express-x-hub');

console.log('=== SERVER STARTING ===');
console.log('Environment variables:');
console.log('PORT:', process.env.PORT || 5000);
console.log('APP_SECRET:', process.env.APP_SECRET ? 'SET' : 'NOT SET');
console.log('TOKEN:', process.env.TOKEN || 'token');

app.set('port', (process.env.PORT || 5000));

// Middleware setup logs
console.log('Setting up middleware...');
app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
console.log('X-Hub middleware configured');

app.use(bodyParser.json());
console.log('Body parser configured');

var token = process.env.TOKEN || 'token';
var received_updates = [];

// Log all incoming requests
app.use(function(req, res, next) {
  console.log('\n=== INCOMING REQUEST ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Query params:', JSON.stringify(req.query));
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body));
  next();
});

app.get('/', function(req, res) {
  console.log('GET / - Displaying received updates');
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

app.get(['/facebook', '/instagram', '/threads'], function(req, res) {
  console.log('=== WEBHOOK VERIFICATION REQUEST ===');
  console.log('Path:', req.path);
  console.log('hub.mode:', req.query['hub.mode']);
  console.log('hub.verify_token:', req.query['hub.verify_token']);
  console.log('Expected token:', token);
  console.log('hub.challenge:', req.query['hub.challenge']);
  
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    console.log('✓ Verification successful - sending challenge');
    res.send(req.query['hub.challenge']);
  } else {
    console.log('✗ Verification failed - sending 400');
    res.sendStatus(400);
  }
});

app.post('/facebook', function(req, res) {
  console.log('\n=== FACEBOOK POST REQUEST ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Facebook request body:', JSON.stringify(req.body, null, 2));
  console.log('Content-Type:', req.headers['content-type']);
  console.log('X-Hub-Signature:', req.headers['x-hub-signature']);
  
  // if (!req.isXHubValid()) {
  //   console.log('Warning - request header X-Hub-Signature not present or invalid');
  //   res.sendStatus(401);
  //   return;
  // }
  
  console.log('✓ Request header X-Hub-Signature validated (validation disabled)');
  
  // Process the Facebook updates here
  received_updates.unshift(req.body);
  console.log('✓ Update stored. Total updates:', received_updates.length);
  
  res.sendStatus(200);
  console.log('✓ Response 200 sent');
});

app.post('/instagram', function(req, res) {
  console.log('\n=== INSTAGRAM POST REQUEST ===');
  console.log('Instagram request body:', JSON.stringify(req.body, null, 2));
  
  // Process the Instagram updates here
  received_updates.unshift(req.body);
  console.log('✓ Update stored. Total updates:', received_updates.length);
  
  res.sendStatus(200);
  console.log('✓ Response 200 sent');
});

app.post('/threads', function(req, res) {
  console.log('\n=== THREADS POST REQUEST ===');
  console.log('Threads request body:', JSON.stringify(req.body, null, 2));
  
  // Process the Threads updates here
  received_updates.unshift(req.body);
  console.log('✓ Update stored. Total updates:', received_updates.length);
  
  res.sendStatus(200);
  console.log('✓ Response 200 sent');
});

// Error handling middleware
app.use(function(err, req, res, next) {
  console.error('\n=== ERROR OCCURRED ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  res.sendStatus(500);
});

app.listen(app.get('port'), function() {
  console.log('\n=== SERVER RUNNING ===');
  console.log('Node app is running on port', app.get('port'));
  console.log('Listening for webhooks at:');
  console.log('- GET/POST /facebook');
  console.log('- GET/POST /instagram');
  console.log('- GET/POST /threads');
  console.log('========================\n');
});

// Remove the duplicate app.listen() at the bottom
