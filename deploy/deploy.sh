#!/usr/bin/env bash
set -euo pipefail

ROOT="${PTSMS_ROOT:-/srv/ptsms}"

cd "$ROOT"
git pull --ff-only

cd "$ROOT/backend"
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput

cd "$ROOT/frontend"
npm ci
npm run build

sudo systemctl restart ptsms

echo "Deployed. Check: sudo systemctl status ptsms"
