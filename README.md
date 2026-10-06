# Paul Tours Safari Management System

Staff-only desk for leads, clients, bookings, quotations, itineraries, invoices, hotel vendors, and the cashbook.

## Run it

Backend uses **PostgreSQL** database `safari` by default. Create it once if it does not exist:

```bash
createdb safari
```

Copy `backend/.env.example` to `backend/.env` and set `PTSMS_DB_USER` and `PTSMS_DB_PASSWORD`.

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py bootstrap_admin
python manage.py seed_company_branding
python manage.py seed_safari_types
python manage.py runserver
```

`bootstrap_admin` creates the first super admin only when none exists. Default sign-in:

- Email: `admin@paultours.local`
- Password: `PaulTours#2026`

Override with `PTSMS_ADMIN_EMAIL` and `PTSMS_ADMIN_PASSWORD` before running `bootstrap_admin`. Change the password after first sign-in.

`seed_company_branding` loads the logo from `assets/company-logo.png` and default brand colors into the database so the login page shows the logo and welcome line. It does not create leads, bookings, or list data.

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## First use

1. Sign in as super admin, then open **Team** to create roles and staff users.
2. **Settings** — add currencies, destinations, safari types, payment methods, and other lists (empty until you add them).

Permission codes are created on migrate so roles can be configured.

## Host on one VPS

Staff open one hostname. nginx serves the React build and forwards `/api/` to gunicorn. PostgreSQL and uploaded files stay on the same machine.

Examples live in `deploy/`: `nginx.conf`, `gunicorn.service`, `env.production.example`, and `deploy.sh`.

### 1. Server

Ubuntu 22.04/24.04, about 2 GB RAM. Create a user `ptsms` and install packages:

```bash
sudo apt update
sudo apt install -y python3-venv python3-dev postgresql nginx git build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Place the repo at `/srv/ptsms` (git clone or rsync). The `ptsms` user should own that tree.

### 2. PostgreSQL

```bash
sudo -u postgres createuser ptsms
sudo -u postgres createdb -O ptsms safari
sudo -u postgres psql -c "ALTER USER ptsms WITH PASSWORD 'choose-a-strong-password';"
```

### 3. App env and first migrate

```bash
cp /srv/ptsms/deploy/env.production.example /srv/ptsms/backend/.env
# edit .env: secret key, DB password, PTSMS_ALLOWED_HOSTS, CORS, CSRF origins
cd /srv/ptsms/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py bootstrap_admin
python manage.py seed_company_branding
python manage.py seed_safari_types
python manage.py collectstatic --noinput
```

Change the admin password after first sign-in.

### 4. Frontend build

```bash
cd /srv/ptsms/frontend
npm ci
npm run build
```

nginx `root` is `frontend/dist`. The UI calls `/api/` on the same host, so no extra frontend env is required.

### 5. gunicorn

```bash
sudo cp /srv/ptsms/deploy/gunicorn.service /etc/systemd/system/ptsms.service
sudo systemctl daemon-reload
sudo systemctl enable --now ptsms
```

Adjust paths in the unit if the app is not under `/srv/ptsms`.

### 6. nginx

```bash
sudo cp /srv/ptsms/deploy/nginx.conf /etc/nginx/sites-available/ptsms
sudo ln -sf /etc/nginx/sites-available/ptsms /etc/nginx/sites-enabled/ptsms
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Edit `server_name` to your domain (or the VPS IP for a first test). `/media/` is served from `backend/media`; `/api/` and `/admin/` go to gunicorn.

### 7. HTTPS (when you have a domain)

Point DNS A record at the VPS, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d desk.example.com
```

Set `PTSMS_HTTPS=1` in `.env` and restart gunicorn. Leave `PTSMS_SSL_REDIRECT=0` so nginx (not Django) handles HTTP→HTTPS.

### 8. Later deploys

```bash
sudo -u ptsms bash /srv/ptsms/deploy/deploy.sh
```

Back up PostgreSQL and `backend/media` together.

### Local vs production

Local: `npm run dev` (Vite proxies `/api` and `/media`) and `runserver`, with `PTSMS_DEBUG=1`.

VPS: `npm run build` served by nginx, gunicorn for Django, `PTSMS_DEBUG=0`.
