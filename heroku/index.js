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

const fs = require('fs');
const path = require('path');

console.log('=== SERVER STARTING ===');
console.log('Environment variables:');
console.log('PORT:', process.env.PORT || 5001);
console.log('APP_SECRET:', process.env.APP_SECRET ? 'SET' : 'NOT SET');
console.log('TOKEN:', process.env.TOKEN || 'token');

app.set('port', (process.env.PORT || 5001));

// Middleware setup logs
console.log('Setting up middleware...');
app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
console.log('X-Hub middleware configured');

app.use(function(req, res, next) {
  console.log('\n=== RAW REQUEST (before body parser) ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('All headers:', JSON.stringify(req.headers, null, 2));
  next();
});

app.use(bodyParser.json());
console.log('Body parser configured');

var token = process.env.TOKEN || 'token';
var received_updates = [];

// Path to the JSON file
const DATA_FILE = path.join(__dirname, 'facebook_webhooks.json');

// Initialize the JSON file if it doesn't exist
function initializeDataFile() {
  fs.access(DATA_FILE, function(err) {
    if (err) {
      console.log('Creating new data file:', DATA_FILE);
      fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), function(writeErr) {
        if (writeErr) {
          console.error('Failed to create data file:', writeErr);
        } else {
          console.log('✓ Data file created');
        }
      });
    } else {
      console.log('✓ Data file exists:', DATA_FILE);
    }
  });
}

// Save data to JSON file
function saveToFile(data, callback) {
  fs.readFile(DATA_FILE, 'utf8', function(err, fileContent) {
    if (err) {
      console.error('✗ Error reading file:', err);
      if (callback) callback(false);
      return;
    }
    
    var existingData = [];
    try {
      existingData = JSON.parse(fileContent);
    } catch (parseErr) {
      console.error('✗ Error parsing JSON:', parseErr);
      existingData = [];
    }
    
    // Add new data with timestamp
    var newEntry = {
      timestamp: new Date().toISOString(),
      data: data
    };
    existingData.push(newEntry);
    
    // Write back to file
    fs.writeFile(DATA_FILE, JSON.stringify(existingData, null, 2), function(writeErr) {
      if (writeErr) {
        console.error('✗ Error saving to file:', writeErr);
        if (callback) callback(false);
      } else {
        console.log('✓ Data saved to file. Total entries:', existingData.length);
        if (callback) callback(true);
      }
    });
  });
}

// Initialize data file on startup
initializeDataFile();

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

// New endpoint to view the JSON file contents
app.get('/facebook/data', function(req, res) {
  console.log('GET /facebook/data - Reading stored webhooks');
  fs.readFile(DATA_FILE, 'utf8', function(err, data) {
    if (err) {
      console.error('Error reading data file:', err);
      res.status(500).send('Error reading data file');
      return;
    }
    
    try {
      var jsonData = JSON.parse(data);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(jsonData, null, 2));
    } catch (parseErr) {
      console.error('Error parsing JSON:', parseErr);
      res.status(500).send('Error parsing data file');
    }
  });
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
  console.log('✓ Update stored in memory. Total updates:', received_updates.length);
  
  // Save to JSON file
  saveToFile(req.body, function(success) {
    if (success) {
      console.log('✓ Successfully saved to file');
    }
  });
  
  
  
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
  console.log('- GET /facebook/data (view stored webhooks)');
  console.log('========================\n');
});
