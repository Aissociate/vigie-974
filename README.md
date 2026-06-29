# VIGIE 974

Landing page haute conversion + paiement Stripe + livraison automatique par email (AgentMail).
Base de propriétaires de locations courte durée à La Réunion (974).

## Flux
Pub → `index.html` → formulaire → aperçu masqué → curseur d'offre (50 €/contact, dégressif)
→ Stripe Checkout → webhook → AgentMail envoie le CSV → `merci.html`.

## Structure
```
.
├── index.html              Landing page
├── merci.html              Confirmation après paiement
├── server.js               Serveur Express (option sans Vercel)
├── api/
│   ├── create-checkout-session.js   Crée la session de paiement
│   └── stripe-webhook.js            Reçoit la confirmation Stripe
├── lib/
│   ├── stripe-vigie974.js           Prix dégressif (recalculé serveur) + webhook
│   ├── livraison-vigie974.js        Sélection par secteur + CSV + envoi AgentMail
│   └── base-974-complete.csv        Fichier-source (sans DOB / SMS / adresse)
└── docs/
    ├── mails-et-scripts.md          Kit prospection + mails du tunnel
    ├── mise-en-ligne.md             Checklist détaillée
    └── Base_VIGIE_974.xlsx          Base de travail (pilotage inclus)
```

## Tarif (recalculé côté serveur, jamais côté navigateur)
50 € le contact · dès 10 : −10 % · dès 50 : −20 % · toute la base (218) : −30 %.

## Démarrage local
```bash
npm install
cp .env.example .env        # renseignez vos clés
npm start                   # http://localhost:3000
```
Test sans dépense : clés `sk_test_…`, carte `4242 4242 4242 4242`.

## Déploiement Vercel
1. Importez le dépôt sur vercel.com
2. Variables d'environnement : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `AGENTMAIL_API_KEY`
3. Webhook Stripe → `https://votre-domaine/api/stripe-webhook`, événement `checkout.session.completed`
4. `index.html` appelle `/api/create-checkout-session` en relatif : rien à changer si tout est sur le même domaine.

## Pousser sur GitHub
Le dépôt est déjà initialisé (un premier commit existe). Créez un dépôt **vide** sur github.com, puis :

```bash
git remote add origin https://github.com/VOTRE_COMPTE/vigie-974.git
git push -u origin main
```

Ou avec GitHub CLI (crée le dépôt et pousse en une commande) :
```bash
gh repo create vigie-974 --private --source=. --push
```

## Sécurité
- Aucune clé n'est en dur dans le code : tout passe par les variables d'environnement.
- `.env` est ignoré par git.
- **Régénérez la clé AgentMail** si elle a été partagée en clair.

## À finir de votre côté
- Pages Mentions légales / CGV / Confidentialité (liens présents dans le pied de page).
- Pixel publicitaire (Meta / Google) si vous trackez les conversions.
- Fonction de livraison : déjà fournie dans `lib/livraison-vigie974.js`.
