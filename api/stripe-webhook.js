const { handleWebhook } = require('../lib/stripe-vigie974');

// Vercel : on désactive le bodyParser pour récupérer le corps BRUT
// (nécessaire à la vérification de signature Stripe).
async function handler(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  await handleWebhook(req, res, Buffer.concat(chunks));
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
