/**
 * VIGIE 974 — Registre des contacts vendus en EXCLUSIVITÉ
 * -------------------------------------------------------
 * Quand un lot est acheté en « exclusivité », les contacts livrés sortent
 * définitivement de la base : ils ne doivent plus jamais être proposés ni
 * livrés à un autre acheteur (exclusif OU standard).
 *
 * Ce module tient ce registre dans un simple fichier JSON :
 *   data/exclusifs-vendus.json  →  { "vendus": ["0692…", …], "updated": "…" }
 *
 * La clé d'un contact est son numéro normalisé (chiffres uniquement), unique
 * sur les 218 entrées du périmètre.
 *
 * ⚠️ PRODUCTION (Vercel & co) : le système de fichiers des fonctions
 * serverless est EPHÉMÈRE — une écriture n'est pas garantie d'un appel à
 * l'autre. Pour une vraie persistance, branchez `lireVendus`/`ajouterVendus`
 * sur un store durable (Vercel KV, Upstash Redis, Postgres…). L'implémentation
 * fichier ci-dessous fait foi pour le serveur Node local (server.js) et sert de
 * référence. Surchargez le dossier via la variable d'environnement DATA_DIR.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const LEDGER_PATH = process.env.EXCLUSIFS_PATH || path.join(DATA_DIR, 'exclusifs-vendus.json');

/** Clé stable d'un contact : son numéro réduit aux chiffres. */
function cleContact(row) {
  const src = (row.Autres || row.Telephone || '').toString();
  return src.replace(/\D/g, '');
}

/** Lit le registre. Renvoie un Set de clés (vide si le fichier n'existe pas). */
function lireVendus() {
  try {
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
    const data = JSON.parse(raw);
    return new Set(Array.isArray(data.vendus) ? data.vendus : []);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('registre-exclusifs lecture:', e.message);
    return new Set();
  }
}

/** Nombre de contacts déjà sortis de la base (vendus en exclusif). */
function compteVendus() {
  return lireVendus().size;
}

/**
 * Ajoute des clés au registre et persiste. Idempotent (déduplication par Set).
 * Renvoie le nombre total de contacts vendus après ajout.
 */
function ajouterVendus(cles) {
  const vendus = lireVendus();
  for (const c of cles) if (c) vendus.add(c);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      LEDGER_PATH,
      JSON.stringify({ vendus: Array.from(vendus), updated: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (e) {
    console.error('registre-exclusifs écriture (non persistée ?):', e.message);
  }
  return vendus.size;
}

module.exports = { cleContact, lireVendus, compteVendus, ajouterVendus, LEDGER_PATH };
