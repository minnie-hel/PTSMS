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
