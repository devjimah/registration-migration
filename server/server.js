'use strict';

var path = require('path');
var express = require('express');

var app = express();
var PORT = process.env.PORT || 3000;

// In-memory "database". Seeded with one account so the duplicate-email path is testable.
var users = [{ id: 1, name: 'Existing User', email: 'taken@example.com', plan: 'free' }];

var PLANS = [
  { id: 'free', name: 'Free', priceCents: 0 },
  { id: 'pro', name: 'Pro', priceCents: 1200 },
  { id: 'team', name: 'Team', priceCents: 4900 }
];

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function findUser(email) {
  var needle = String(email || '').trim().toLowerCase();
  return users.find(function (u) { return u.email === needle; });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/jquery', express.static(path.join(__dirname, '..', 'node_modules', 'jquery', 'dist')));

app.get('/api/plans', function (req, res) {
  res.json({ plans: PLANS });
});

app.post('/api/check-email', function (req, res) {
  var email = req.body && req.body.email;
  if (!EMAIL_RE.test(String(email || ''))) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  res.json({ available: !findUser(email) });
});

app.post('/api/register', function (req, res) {
  var body = req.body || {};
  var errors = {};

  if (!body.name || String(body.name).trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!EMAIL_RE.test(String(body.email || ''))) errors.email = 'Enter a valid email address';
  else if (findUser(body.email)) errors.email = 'An account with this email already exists';
  if (!body.password || String(body.password).length < 8) errors.password = 'Password must be at least 8 characters';
  if (!PLANS.some(function (p) { return p.id === body.plan; })) errors.plan = 'Choose a plan';

  if (Object.keys(errors).length) {
    return res.status(422).json({ errors: errors });
  }

  var user = {
    id: users.length + 1,
    name: String(body.name).trim(),
    email: String(body.email).trim().toLowerCase(),
    plan: body.plan
  };
  users.push(user);
  res.status(201).json({ user: user });
});

app.listen(PORT, function () {
  console.log('Registration server listening on http://localhost:' + PORT);
});
