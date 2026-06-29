/*
# VIGIE 974 — Persistance de l'exclusivité

## Résumé
Crée la table `exclusifs_vendus` : registre des contacts achetés en EXCLUSIVITÉ
et donc retirés définitivement de la base (plus jamais livrés, ni en exclusif ni
en standard). Remplace, en production, le fichier de secours data/exclusifs-vendus.json.

## Table : exclusifs_vendus
- `cle` (text, pk) : numéro de téléphone normalisé (chiffres uniquement). Même clé
  que côté code (lib/registre-exclusifs.js → cleContact) et que la base CSV.
- `stripe_session_id` (text) : session Stripe à l'origine de la vente (traçabilité).
- `created_at` (timestamptz) : date de sortie de la base.

Le décompte `count(*)` alimente GET /api/disponibilite : disponibles = 218 − count.

## Sécurité
- RLS activée. Écriture réservée au service_role (webhook backend) — aucune policy
  write pour anon/authenticated → bloqué par défaut.
- SELECT autorisé à anon/authenticated (le décompte de disponibilité n'est pas sensible).
*/

CREATE TABLE IF NOT EXISTS exclusifs_vendus (
  cle                text PRIMARY KEY,
  stripe_session_id  text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exclusifs_vendus_created_idx ON exclusifs_vendus (created_at);

ALTER TABLE exclusifs_vendus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_exclusifs" ON exclusifs_vendus;
CREATE POLICY "anon_select_exclusifs" ON exclusifs_vendus FOR SELECT
  TO anon, authenticated USING (true);

-- Écriture (INSERT/UPDATE/DELETE) : aucune policy → réservé au service_role qui bypass la RLS.
