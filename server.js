/**
 * Variante serveur classique (sans Vercel).
 *   npm install
 *   node server.js
 * Sert le site statique + les deux endpoints.
 */
const express = require('express');
const path = require('path');
const { createCheckoutSession, handleWebhook } = require('./lib/stripe-vigie974');

const app = express();

// Le webhook doit recevoir le corps BRUT → avant express.json()
app.post('/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => handleWebhook(req, res, req.body));

app.use(express.json());
app.post('/api/create-checkout-session', createCheckoutSession);
app.get('/api/disponibilite', require('./api/disponibilite'));

// Site statique (index.html, merci.html)
app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`VIGIE 974 en ligne sur http://localhost:${port}`));
