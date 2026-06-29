/**
 * VIGIE 974 — Client Supabase (backend, service_role)
 * ---------------------------------------------------
 * Renvoie un client Supabase configuré, ou `null` si les variables
 * d'environnement ne sont pas définies. Dans ce dernier cas, les modules
 * appelants retombent sur leur stockage de secours (fichier JSON) — pratique
 * pour le dev local et les tests sans base.
 *
 * Variables d'environnement :
 *   SUPABASE_URL                = https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   = clé service_role (backend uniquement — JAMAIS côté client)
 *
 * On utilise la clé service_role : elle bypass la RLS, ce qui est voulu côté
 * backend/webhook. Ne l'exposez jamais au navigateur.
 */
let cached; // undefined = pas encore résolu ; null = non configuré

function getClient() {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

module.exports = getClient;
