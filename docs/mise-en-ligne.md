# VIGIE 974 — Mise en ligne : où on en est

## Réponse courte
Le **code et les contenus sont prêts**. Ce qui reste n'est pas du développement, c'est de la **configuration** : poser vos clés, déployer, tester. Détail ci-dessous.

---

## Les fichiers livrés

| Fichier | Rôle | État |
|---|---|---|
| `vigie-974.html` | Landing page complète (hero, aperçu masqué, curseur d'offre, paiement, FAQ, formulaire) | ✅ Prêt |
| `merci.html` | Page de confirmation après paiement | ✅ Prêt |
| `stripe-vigie974.js` | Création de la session de paiement + webhook (prix recalculé serveur) | ✅ Prêt, à déployer |
| `livraison-vigie974.js` | Sélection par secteur + génération CSV + envoi email (AgentMail) | ✅ Prêt, inbox câblée |
| `base-974-complete.csv` | Fichier-source lu par le serveur (sans date de naissance / SMS / adresse) | ✅ Prêt |
| `Base_VIGIE_974.xlsx` | Base de travail (3 onglets : base, pilotage, lisez-moi) | ✅ Prêt |
| `VIGIE-974-mails-et-scripts.md` | Kit prospection client + mails du tunnel | ✅ Prêt |

## Le flux, de bout en bout
Pub → `vigie-974.html` → formulaire → aperçu masqué → curseur (50 €/contact, dégressif) → **Stripe Checkout** → webhook `checkout.session.completed` → **AgentMail** envoie le CSV → `merci.html`.

Chaque maillon est codé et testé en local (la sélection par secteur et le plafond à 218 ont été vérifiés).

---

## Ce qu'il reste à faire (config, ~30–45 min)

### 1. Installer
```
npm install stripe agentmail
```

### 2. Poser les variables d'environnement
- `STRIPE_SECRET_KEY` — votre clé Stripe (commencez par `sk_test_…`)
- `STRIPE_WEBHOOK_SECRET` — `whsec_…` (donné quand vous créez le webhook dans Stripe)
- `SITE_URL` — ex. `https://votre-domaine.fr`
- `AGENTMAIL_API_KEY` — votre clé AgentMail
- `AGENTMAIL_INBOX_ID` — facultatif (l'inbox est déjà câblée par défaut)

### 3. Déployer les endpoints (Vercel)
Créer `/api/create-checkout-session.js` et `/api/stripe-webhook.js` (le code exact est en commentaire en bas de `stripe-vigie974.js`). Déposer `livraison-vigie974.js` et `base-974-complete.csv` à côté.

### 4. Brancher la page
Dans `vigie-974.html`, mettre l'URL réelle :
```js
var STRIPE_ENDPOINT = 'https://votre-domaine.fr/api/create-checkout-session';
```

### 5. Créer le webhook Stripe
Dans le dashboard Stripe → Webhooks → endpoint = `https://votre-domaine.fr/api/stripe-webhook`, événement `checkout.session.completed`.

### 6. Tester sans dépenser
Clés `sk_test_…`, carte `4242 4242 4242 4242`. Vérifier : le prix suit le curseur → paiement → CSV reçu par email → redirection vers `/merci`.

### 7. (Optionnel mais conseillé) Détail sur la page merci
Dans `success_url`, ajouter `&qty=${contacts}&zone=${encodeURIComponent(zone)}` pour afficher le récap exact.

---

## Décisions qui restent vôtres (je ne peux pas les faire à votre place)
- **Saisir vos clés** Stripe et AgentMail (secrets — en variables d'environnement, jamais en dur).
- **Brancher un vrai moyen de paiement** : c'est Stripe qui encaisse, pas la page.
- **Mentions légales / CGV / confidentialité** : les liens existent dans le pied de page mais les pages sont à écrire (et à faire valider, vous avez déjà votre avocat).
- **Pixel pub** (Meta/Google) à ajouter si vous trackez les conversions.

## Rappel sécurité
La **clé API AgentMail** transmise dans la conversation est exposée : régénérez-la dans AgentMail et mettez la nouvelle en variable d'environnement. L'identifiant d'inbox, lui, n'est pas un secret.

---

## En une phrase
Tout ce qui devait être construit l'est ; il vous reste à **coller vos clés, déployer sur Vercel et tester en mode test** — aucune ligne de code à écrire de votre côté, sauf la fonction de livraison qui est déjà fournie.
