/**
 * VIGIE 974 — Livraison de la base après paiement
 * ------------------------------------------------
 * Appelé par le webhook Stripe (checkout.session.completed).
 * 1. Sélectionne N contacts dans la base, filtrés par secteur si précisé
 * 2. Génère un CSV avec les coordonnées COMPLÈTES
 * 3. L'envoie en pièce jointe par email via AgentMail
 *
 * Dépendances :   npm install agentmail
 *
 * Variables d'environnement à définir :
 *   AGENTMAIL_API_KEY   = am_us_xxx          (votre clé AgentMail)
 *   AGENTMAIL_INBOX_ID  = (optionnel) écrase l'inbox par défaut câblée ci-dessous
 *   BASE_CSV_PATH       = ./base-974-complete.csv    (le fichier-base complet, optionnel)
 *
 * Le fichier base-974-complete.csv doit être déployé à côté de ce module.
 */

const fs = require('fs');
const path = require('path');
const { AgentMailClient } = require('agentmail');
const { cleContact, lireVendus, ajouterVendus } = require('./registre-exclusifs');

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
const INBOX_ID = process.env.AGENTMAIL_INBOX_ID
  || 'am_us_inbox_a7ce05e6a18166570e40770cb957cece62f98a941502e5476f14565207566215';
const BASE_PATH = process.env.BASE_CSV_PATH || path.join(__dirname, 'base-974-complete.csv');

const MAX_CONTACTS = 2182; // capacité affichée (closing manuel) — la sélection réelle est limitée par le pool disponible

/* ── Mapping secteur (mêmes règles que la base) ─────────────────────────────── */
const SUBZONES = {
  'saint-gilles / la saline': ['97434', '97435', '97422'],
  'saint-pierre / étang-salé': ['97410', '97432', '97427'],
};

/** Normalise une zone du formulaire → filtre applicable aux lignes. */
function zoneMatcher(zone) {
  const z = (zone || '').trim().toLowerCase();
  if (!z || z === 'multi-zones' || z === 'non précisé') return () => true; // toute la base 974
  if (SUBZONES[z]) {
    const cps = SUBZONES[z];
    return (row) => cps.includes(row.CP);
  }
  // Ouest / Sud / Nord / Est
  const cap = z.charAt(0).toUpperCase() + z.slice(1);
  return (row) => row.Secteur === cap;
}

/* ── Lecture de la base ─────────────────────────────────────────────────────── */
function loadBase() {
  const raw = fs.readFileSync(BASE_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(';');
  return lines.slice(1).map((line) => {
    const cells = line.split(';');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (cells[i] || '').trim(); });
    return obj;
  });
}

/** Périmètre 974 amputé des contacts déjà vendus en exclusivité (sortis de la base). */
function poolDisponible(all, vendus = new Set()) {
  return all.filter((r) => r.Secteur && r.Secteur !== 'Mayotte' && !vendus.has(cleContact(r)));
}

/** Sélectionne `n` lignes : d'abord celles du secteur demandé, complétées si besoin. */
function selectRows(all, zone, n, vendus = new Set()) {
  const inPerimeter = poolDisponible(all, vendus);
  const match = zoneMatcher(zone);
  const primary = inPerimeter.filter(match);
  const rest = inPerimeter.filter((r) => !match(r));
  return primary.concat(rest).slice(0, n);
}

/* ── Génération du CSV livré ────────────────────────────────────────────────── */
function buildCsv(rows) {
  const head = ['Civilite', 'Nom', 'Prenom', 'Telephone', 'Autres numéros', 'Ville', 'Secteur',
    'Statut', 'Date contact', 'Relance', 'Notes'];
  const esc = (v) => {
    v = (v || '').toString();
    return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const lines = [head.join(';')];
  for (const r of rows) {
    lines.push([r.Civilite, r.Nom, r.Prenom, r.Telephone, r.Autres, r.Ville, r.Secteur,
      'À contacter', '', '', ''].map(esc).join(';'));
  }
  return '\uFEFF' + lines.join('\r\n'); // BOM → ouverture propre dans Excel
}

/* ── Email ──────────────────────────────────────────────────────────────────── */
function emailHtml(contacts, zone, count, exclusif) {
  const excluLigne = exclusif ? `
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee">Mode</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right"><b style="color:#FF5A3C">Exclusivité</b></td></tr>` : '';
  const excluNote = exclusif ? `
    <p style="font-size:13px;color:#0A1F2B;background:#FFF3F0;border-left:3px solid #FF5A3C;padding:10px 12px;margin:14px 0 0">
      <b>Exclusivité garantie.</b> Ces ${count} contacts sont retirés définitivement de la base :
      ils ne seront livrés à aucun autre acheteur.
    </p>` : '';
  return `
  <div style="font-family:Arial,sans-serif;color:#0A1F2B;max-width:560px">
    <h2 style="color:#FF5A3C;margin:0 0 4px">Votre base VIGIE 974 est prête</h2>
    <p style="color:#555;margin:0 0 18px">Merci pour votre commande. Le fichier est en pièce jointe.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee">Contacts livrés</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right"><b>${count}</b></td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #eee">Secteur</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right"><b>${zone || 'Toute la base'}</b></td></tr>${excluLigne}
    </table>${excluNote}
    <p style="font-size:13px;color:#555;margin:18px 0 0">
      Le fichier contient les coordonnées complètes (civilité, nom, téléphone, ville, secteur)
      et des colonnes de suivi prêtes à l'emploi.
    </p>
    <p style="font-size:12px;color:#888;margin:16px 0 0;line-height:1.6">
      Prospection responsable : informez les personnes contactées de l'origine des données
      et respectez leur droit d'opposition. Conservez la trace des refus et ne les recontactez pas.
    </p>
  </div>`;
}

/* ── Fonction principale appelée par le webhook ─────────────────────────────── */
async function livrerLaBase({ email, contacts, zone, exclusif, session }) {
  if (!email) throw new Error('Email destinataire manquant');
  exclusif = exclusif === true || exclusif === 'true' || exclusif === 1 || exclusif === '1';
  let n = parseInt(contacts, 10);
  if (!Number.isInteger(n) || n < 1) n = 1;
  if (n > MAX_CONTACTS) n = MAX_CONTACTS;

  const vendus = await lireVendus();
  const rows = selectRows(loadBase(), zone, n, vendus);

  // EXCLUSIVITÉ : on sort définitivement les contacts livrés de la base.
  // Fait AVANT l'envoi : si la livraison échoue, le webhook rejoue ; le registre
  // étant idempotent (clés dédupliquées), aucun double-comptage n'est possible.
  if (exclusif && rows.length) {
    const restant = await ajouterVendus(rows.map(cleContact), { session });
    console.log(`🔒 Exclusivité : ${rows.length} contacts retirés de la base (${restant} retirés au total).`);
  }

  const csv = buildCsv(rows);
  const base64 = Buffer.from(csv, 'utf8').toString('base64');
  const stamp = new Date().toISOString().slice(0, 10);
  const tagExclu = exclusif ? ' (exclusivité)' : '';

  const res = await client.inboxes.messages.send(INBOX_ID, {
    to: email,
    subject: `Votre base VIGIE 974 — ${rows.length} contacts${tagExclu}`,
    text: `Votre base VIGIE 974 est prête (${rows.length} contacts, secteur ${zone || 'toute la base'}${tagExclu}). Fichier CSV en pièce jointe.`,
    html: emailHtml(contacts, zone, rows.length, exclusif),
    attachments: [{
      filename: `base-vigie-974-${stamp}${exclusif ? '-exclusif' : ''}.csv`,
      content_type: 'text/csv',
      content: base64,
    }],
  });

  console.log(`📧 Livré : ${rows.length} contacts${tagExclu} → ${email} (message ${res.message_id})`);
  return res;
}

module.exports = { livrerLaBase, selectRows, poolDisponible, zoneMatcher };
