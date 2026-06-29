/**
 * VIGIE 974 — Backend de paiement Stripe
 * ----------------------------------------
 * Deux fonctions :
 *   1) createCheckoutSession  → crée la session de paiement (appelée par le bouton "Payer")
 *   2) handleWebhook          → reçoit la confirmation de paiement pour livrer la base par email
 *
 * Le PRIX EST RECALCULÉ ICI, côté serveur. On ne fait jamais confiance au montant
 * envoyé par le navigateur (sinon n'importe qui peut payer 1 €).
 *
 * ── Déploiement rapide (Vercel) ───────────────────────────────────────────────
 *   1. npm install stripe
 *   2. Placez ce fichier dans  /api/create-checkout-session.js
 *      (et exportez handleWebhook depuis  /api/stripe-webhook.js — voir bas de fichier)
 *   3. Variables d'environnement à définir dans Vercel :
 *        STRIPE_SECRET_KEY        = sk_live_xxx (ou sk_test_xxx pour tester)
 *        STRIPE_WEBHOOK_SECRET    = whsec_xxx
 *        SITE_URL                 = https://votre-domaine.fr
 *   4. Dans vigie-974.html, mettez :
 *        var STRIPE_ENDPOINT = 'https://votre-domaine.fr/api/create-checkout-session';
 *
 *   (Netlify / Cloudflare / Express : même logique, voir l'adaptateur Express en bas.)
 * ──────────────────────────────────────────────────────────────────────────────
 */

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { livrerLaBase } = require('./livraison-vigie974');

const MAX_CONTACTS = 218;      // taille réelle du périmètre 974
const UNIT_EUR     = 50;       // 50 € le contact

/** Prix unitaire en CENTIMES selon les paliers dégressifs. */
function unitAmountCents(qty) {
  if (qty >= MAX_CONTACTS) return 3500; // toute la base  → -30 %  (35 €)
  if (qty >= 50)           return 4000; // dès 50         → -20 %  (40 €)
  if (qty >= 10)           return 4500; // dès 10         → -10 %  (45 €)
  return 5000;                          // 1 à 9          → plein   (50 €)
}

function discountLabel(qty) {
  if (qty >= MAX_CONTACTS) return '-30% (base complète)';
  if (qty >= 50)           return '-20% (dès 50)';
  if (qty >= 10)           return '-10% (dès 10)';
  return 'prix plein';
}

/* ========================================================================== */
/* 1) CRÉATION DE LA SESSION DE PAIEMENT                                       */
/* ========================================================================== */
async function createCheckoutSession(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    let contacts = parseInt(body.contacts, 10);
    const zone   = (body.zone  || 'non précisé').toString().slice(0, 60);
    const email  = (body.email || '').toString().slice(0, 120);

    // Validation stricte de la quantité
    if (!Number.isInteger(contacts) || contacts < 1) contacts = 1;
    if (contacts > MAX_CONTACTS) contacts = MAX_CONTACTS;

    const unit = unitAmountCents(contacts);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [{
        quantity: contacts,
        price_data: {
          currency: 'eur',
          unit_amount: unit, // prix unitaire HT, remise déjà appliquée
          product_data: {
            name: `Base VIGIE 974 — ${contacts} contact(s)`,
            description: `Secteur : ${zone} · ${discountLabel(contacts)}`,
          },
        },
      }],
      // Récupéré dans le webhook pour livrer la bonne tranche de la base
      metadata: { contacts: String(contacts), zone, unit_cents: String(unit) },
      success_url: `${process.env.SITE_URL}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.SITE_URL}/#paiement`,
      // TVA : décommentez si vous facturez la TVA via Stripe Tax
      // automatic_tax: { enabled: true },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe createCheckoutSession:', err);
    res.status(500).json({ error: 'Création de session impossible' });
  }
}

/* ========================================================================== */
/* 2) WEBHOOK — confirmation de paiement → livraison                          */
/* ========================================================================== */
/**
 * IMPORTANT : ce handler doit recevoir le CORPS BRUT de la requête (raw body)
 * pour vérifier la signature. Sur Vercel, désactivez le bodyParser :
 *
 *   export const config = { api: { bodyParser: false } };
 */
async function handleWebhook(req, res, rawBody) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature webhook invalide:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const contacts = parseInt(s.metadata.contacts, 10);
    const zone     = s.metadata.zone;
    const email    = s.customer_details ? s.customer_details.email : s.customer_email;

    // Livraison : sélection des lignes + envoi email avec coordonnées complètes (AgentMail)
    try {
      await livrerLaBase({ email, contacts, zone });
    } catch (e) {
      console.error('Échec livraison (à rejouer) :', e.message);
      // On renvoie 500 pour que Stripe réessaie le webhook automatiquement.
      res.status(500).json({ error: 'delivery_failed' });
      return;
    }
    console.log(`✅ Payé + livré : ${contacts} contacts (secteur ${zone}) → ${email}`);
  }

  res.status(200).json({ received: true });
}

module.exports = { createCheckoutSession, handleWebhook, unitAmountCents };

/* ========================================================================== */
/* VERCEL — fichiers à créer                                                  */
/* ========================================================================== */
/*
  // /api/create-checkout-session.js
  const { createCheckoutSession } = require('../stripe-vigie974');
  module.exports = (req, res) => createCheckoutSession(req, res);

  // /api/stripe-webhook.js
  const { handleWebhook } = require('../stripe-vigie974');
  export const config = { api: { bodyParser: false } };
  module.exports = async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await handleWebhook(req, res, Buffer.concat(chunks));
  };
*/

/* ========================================================================== */
/* EXPRESS — variante serveur classique                                       */
/* ========================================================================== */
/*
  const express = require('express');
  const { createCheckoutSession, handleWebhook } = require('./stripe-vigie974');
  const app = express();

  // Le webhook AVANT express.json(), avec le corps brut :
  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }),
    (req, res) => handleWebhook(req, res, req.body));

  app.use(express.json());
  app.post('/api/create-checkout-session', createCheckoutSession);

  app.listen(3000, () => console.log('VIGIE 974 paiement sur :3000'));
*/
