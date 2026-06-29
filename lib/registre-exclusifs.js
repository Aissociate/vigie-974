/**
 * VIGIE 974 — Registre des contacts vendus en EXCLUSIVITÉ
 * -------------------------------------------------------
 * Quand un lot est acheté en « exclusivité », les contacts livrés sortent
 * définitivement de la base : ils ne doivent plus jamais être proposés ni
 * livrés à un autre acheteur (exclusif OU standard).
 *
 * Deux backends de persistance, choisis automatiquement :
 *   1. SUPABASE (production) — si SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY sont
 *      définis : table `exclusifs_vendus` (voir migration). Persiste réellement,
 *      y compris sur un hébergement serverless à système de fichiers éphémère.
 *   2. FICHIER JSON (dev local / tests) — sinon : data/exclusifs-vendus.json.
 *
 * La clé d'un contact est son numéro normalisé (chiffres uniquement), unique
 * sur les 218 entrées du périmètre. C'est la même clé dans les deux backends.
 *
 * API (asynchrone) :
 *   cleContact(row)          → string (clé stable, synchrone)
 *   lireVendus()             → Promise<Set<string>>
 *   compteVendus()           → Promise<number>
 *   ajouterVendus(cles,meta) → Promise<number>  (idempotent ; meta.session = id Stripe)
 */

const fs = require('fs');
const path = require('path');
const getSupabase = require('./supabase');

const TABLE = 'exclusifs_vendus';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const LEDGER_PATH = process.env.EXCLUSIFS_PATH || path.join(DATA_DIR, 'exclusifs-vendus.json');

/** Clé stable d'un contact : son numéro réduit aux chiffres. */
function cleContact(row) {
  const src = (row.Autres || row.Telephone || '').toString();
  return src.replace(/\D/g, '');
}

/* ── Backend FICHIER ────────────────────────────────────────────────────────── */
function fichierLire() {
  try {
    const data = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    return new Set(Array.isArray(data.vendus) ? data.vendus : []);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('registre-exclusifs lecture fichier:', e.message);
    return new Set();
  }
}

function fichierAjouter(cles) {
  const vendus = fichierLire();
  for (const c of cles) if (c) vendus.add(c);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      LEDGER_PATH,
      JSON.stringify({ vendus: Array.from(vendus), updated: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (e) {
    console.error('registre-exclusifs écriture fichier (non persistée ?):', e.message);
  }
  return vendus.size;
}

/* ── API publique (résout le backend à chaud) ───────────────────────────────── */
async function lireVendus() {
  const supa = getSupabase();
  if (!supa) return fichierLire();
  const { data, error } = await supa.from(TABLE).select('cle');
  if (error) {
    console.error('registre-exclusifs Supabase select:', error.message);
    return new Set(); // fail-open : on ne bloque pas la vente
  }
  return new Set(data.map((r) => r.cle));
}

async function compteVendus() {
  const supa = getSupabase();
  if (!supa) return fichierLire().size;
  const { count, error } = await supa.from(TABLE).select('cle', { count: 'exact', head: true });
  if (error) {
    console.error('registre-exclusifs Supabase count:', error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Ajoute des clés au registre et persiste. Idempotent (dédup par clé).
 * meta.session = identifiant de session Stripe (traçabilité, optionnel).
 * Renvoie le nombre total de contacts vendus après ajout.
 */
async function ajouterVendus(cles, meta = {}) {
  const uniques = Array.from(new Set(cles)).filter(Boolean);
  if (!uniques.length) return compteVendus();
  const supa = getSupabase();
  if (!supa) return fichierAjouter(uniques);
  const rows = uniques.map((cle) => ({ cle, stripe_session_id: meta.session || null }));
  const { error } = await supa.from(TABLE).upsert(rows, { onConflict: 'cle', ignoreDuplicates: true });
  if (error) console.error('registre-exclusifs Supabase upsert:', error.message);
  return compteVendus();
}

module.exports = { cleContact, lireVendus, compteVendus, ajouterVendus, LEDGER_PATH };
