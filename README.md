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
│   ├── stripe-webhook.js            Reçoit la confirmation Stripe
│   └── disponibilite.js             Stock en temps réel (base − exclusifs vendus)
├── lib/
│   ├── stripe-vigie974.js           Prix dégressif (recalculé serveur) + webhook
│   ├── livraison-vigie974.js        Sélection par secteur + CSV + envoi AgentMail
│   ├── registre-exclusifs.js        Registre des contacts vendus en exclusivité
│   └── base-974-complete.csv        Fichier-source (sans DOB / SMS / adresse)
├── data/
│   └── exclusifs-vendus.json        Contacts sortis de la base (état runtime)
└── docs/
    ├── mails-et-scripts.md          Kit prospection + mails du tunnel
    ├── mise-en-ligne.md             Checklist détaillée
    └── Base_VIGIE_974.xlsx          Base de travail (pilotage inclus)
```

## Tarif (recalculé côté serveur, jamais côté navigateur)
50 € le contact · dès 10 : −10 % · dès 50 : −20 % · toute la base (218) : −30 %.

### Option Exclusivité (×2)
Toggle « Exclusivité » sur la page : **tarif doublé, même dégressivité**. Les contacts
achetés en exclusif **sortent définitivement de la base** (registre `data/exclusifs-vendus.json`)
et ne sont plus jamais livrés — ni en exclusif, ni en standard. Les compteurs du front
(`218 disponibles`, hero, aperçu) sont recalculés en direct via `GET /api/disponibilite`.
Exemple : 100 exclusifs vendus → la base affiche `118`.

**Persistance** : `lib/registre-exclusifs.js` choisit automatiquement son backend :
- **Supabase** (production) si `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sont définis →
  table `exclusifs_vendus` (migration `supabase/migrations/20260629170000_add_exclusifs_vendus.sql`).
  Persiste réellement, même sur un FS serverless éphémère.
- **Fichier JSON** (`data/exclusifs-vendus.json`) en repli, pour le dev local et les tests.

### Garantie
Satisfait ou remboursé 7 jours, **y compris sur la véracité des informations** : toute fiche
dont les coordonnées se révèlent fausses ou inexploitables est remplacée — ou remboursée.

## Démarrage local
```bash
npm install
cp .env.example .env        # renseignez vos clés
npm start                   # http://localhost:3000
```
Test sans dépense : clés `sk_test_…`, carte `4242 4242 4242 4242`.

## Déploiement Vercel
1. Importez le dépôt sur vercel.com
2. Variables d'environnement : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`, `AGENTMAIL_API_KEY`, et pour la persistance de l'exclusivité `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
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
