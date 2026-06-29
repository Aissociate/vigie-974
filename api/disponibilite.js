/**
 * GET /api/disponibilite
 * Renvoie l'état du stock pour alimenter les compteurs du front :
 *   { total: 218, vendus: N, disponibles: 218 - N }
 * `vendus` = contacts sortis de la base après vente en exclusivité.
 */
const { MAX_CONTACTS } = require('../lib/stripe-vigie974');
const { compteVendus } = require('../lib/registre-exclusifs');

module.exports = (req, res) => {
  try {
    const vendus = compteVendus();
    const disponibles = Math.max(0, MAX_CONTACTS - vendus);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ total: MAX_CONTACTS, vendus, disponibles });
  } catch (err) {
    console.error('disponibilite:', err);
    res.status(200).json({ total: MAX_CONTACTS, vendus: 0, disponibles: MAX_CONTACTS });
  }
};
