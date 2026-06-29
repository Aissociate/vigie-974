#!/usr/bin/env bash
#
# Pousse ce dépôt sur GitHub en une commande.
#   chmod +x push-to-github.sh
#   ./push-to-github.sh                 # dépôt privé nommé "vigie-974"
#   ./push-to-github.sh mon-repo        # autre nom
#   ./push-to-github.sh mon-repo --public
#
set -e

REPO_NAME="${1:-vigie-974}"
VIS="--private"
[ "$2" = "--public" ] && VIS="--public"

command -v git >/dev/null 2>&1 || { echo "❌ git n'est pas installé."; exit 1; }

# Initialise le dépôt si ce n'est pas déjà fait
if [ ! -d .git ]; then
  git init -q
  git add -A
  git commit -q -m "VIGIE 974 — initial"
fi
git branch -M main 2>/dev/null || true

if command -v gh >/dev/null 2>&1; then
  echo "→ GitHub CLI détecté, création + push automatiques…"
  gh repo create "$REPO_NAME" $VIS --source=. --remote=origin --push
  echo "✅ Terminé. Dépôt poussé."
else
  echo "ℹ️  GitHub CLI (gh) non installé — mode manuel."
  echo "   1) Créez un dépôt VIDE (sans README) sur : https://github.com/new"
  echo "      Nom suggéré : $REPO_NAME"
  printf "   2) Collez l'URL du dépôt (ex. https://github.com/VOUS/%s.git) : " "$REPO_NAME"
  read -r URL
  [ -z "$URL" ] && { echo "❌ URL vide, abandon."; exit 1; }
  git remote remove origin 2>/dev/null || true
  git remote add origin "$URL"
  git push -u origin main
  echo "✅ Terminé. Dépôt poussé sur $URL"
fi
