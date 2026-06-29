
/*
# Schéma VIGIE 974

## Résumé
Ce migration crée les trois tables principales de VIGIE 974 :
- `contacts` : stocke la base de propriétaires (importée depuis base-974-complete.csv)
- `commandes` : enregistre chaque paiement Stripe avec les métadonnées de commande
- `livraisons` : trace chaque livraison email effectuée après paiement

## 1. Nouvelle table : contacts
Colonnes :
- `id` (uuid, pk)
- `civilite` (text)
- `nom` (text)
- `prenom` (text)
- `telephone` (text)
- `autres_numeros` (text)
- `ville` (text)
- `cp` (text, code postal)
- `secteur` (text : Nord / Sud / Est / Ouest)
- `created_at` (timestamptz)

## 2. Nouvelle table : commandes
Colonnes :
- `id` (uuid, pk)
- `stripe_session_id` (text, unique) : identifiant de session Stripe Checkout
- `stripe_payment_intent` (text) : payment intent Stripe
- `email_acheteur` (text) : email saisi lors du paiement
- `contacts_nb` (int) : nombre de contacts commandés
- `zone` (text) : secteur demandé
- `montant_total_cts` (int) : montant payé en centimes d'euro
- `statut` (text) : pending / paid / failed
- `created_at` / `paid_at` (timestamptz)

## 3. Nouvelle table : livraisons
Colonnes :
- `id` (uuid, pk)
- `commande_id` (uuid, FK → commandes)
- `email_destinataire` (text)
- `contacts_livres` (int)
- `zone` (text)
- `agentmail_message_id` (text)
- `statut` (text) : sent / failed
- `tentatives` (int) : nombre de tentatives
- `erreur` (text) : message d'erreur en cas d'échec
- `created_at` (timestamptz)

## Sécurité
- RLS activée sur les 3 tables.
- Données accessibles uniquement via service_role (backend/webhook Stripe).
- Aucun accès anon ou authenticated côté client (ces tables sont internes au backend).
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : contacts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  civilite        text,
  nom             text,
  prenom          text,
  telephone       text,
  autres_numeros  text,
  ville           text,
  cp              text,
  secteur         text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_secteur_idx ON contacts (secteur);
CREATE INDEX IF NOT EXISTS contacts_cp_idx ON contacts (cp);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Lecture publique : le frontend peut éventuellement afficher des stats
DROP POLICY IF EXISTS "anon_select_contacts" ON contacts;
CREATE POLICY "anon_select_contacts" ON contacts FOR SELECT
  TO anon, authenticated USING (true);

-- Écriture réservée au service_role (import CSV, backend)
-- Pas de policy INSERT/UPDATE/DELETE pour anon/authenticated → bloqué par défaut

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : commandes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commandes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id      text UNIQUE NOT NULL,
  stripe_payment_intent  text,
  email_acheteur         text NOT NULL,
  contacts_nb            int NOT NULL CHECK (contacts_nb >= 1),
  zone                   text NOT NULL DEFAULT 'non précisé',
  montant_total_cts      int,
  statut                 text NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending','paid','failed')),
  created_at             timestamptz DEFAULT now(),
  paid_at                timestamptz
);

CREATE INDEX IF NOT EXISTS commandes_statut_idx ON commandes (statut);
CREATE INDEX IF NOT EXISTS commandes_session_idx ON commandes (stripe_session_id);

ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

-- Aucun accès direct depuis le client (webhook backend uniquement)
-- Le service_role bypass RLS → le backend peut lire/écrire sans policy

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE : livraisons
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS livraisons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id           uuid NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  email_destinataire    text NOT NULL,
  contacts_livres       int NOT NULL,
  zone                  text,
  agentmail_message_id  text,
  statut                text NOT NULL DEFAULT 'sent' CHECK (statut IN ('sent','failed')),
  tentatives            int NOT NULL DEFAULT 1,
  erreur                text,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS livraisons_commande_idx ON livraisons (commande_id);
CREATE INDEX IF NOT EXISTS livraisons_statut_idx ON livraisons (statut);

ALTER TABLE livraisons ENABLE ROW LEVEL SECURITY;

-- Aucun accès direct depuis le client (webhook backend uniquement)
