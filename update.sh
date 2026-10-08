#!/usr/bin/env bash
# ------------------------------------------------------------------
# Holt den neuesten Stand aus GitHub und startet die Lernseite neu,
# aber nur, wenn sich wirklich etwas geändert hat.
#
# .env und data/ (Datenbank) stehen nicht im Repository und bleiben
# bei jedem Update unangetastet.
#
# Automatisch alle 5 Minuten (crontab -e):
#   */5 * * * * /opt/lernseite/update.sh >> /var/log/lernseite-update.log 2>&1
# ------------------------------------------------------------------
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${BRANCH:-main}"
cd "$DIR"

# Nicht doppelt laufen lassen
exec 9>"$DIR/.update.lock"
flock -n 9 || exit 0

git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "$(date '+%F %T')  Update ${LOCAL:0:7} → ${REMOTE:0:7}"
CHANGED="$(git diff --name-only "$LOCAL" "$REMOTE")"
git reset --hard --quiet "origin/$BRANCH"

# Nur Lerneinheiten geändert? Dann ist kein Neustart nötig,
# die Seite liest den Ordner lessons/ laufend neu ein.
if echo "$CHANGED" | grep -qv '^lessons/'; then
  echo "  Code geändert, baue und starte neu …"
  docker compose up -d --build --remove-orphans
  docker image prune -f >/dev/null
else
  echo "  Nur Lerneinheiten geändert, kein Neustart nötig."
fi
echo "  fertig."
