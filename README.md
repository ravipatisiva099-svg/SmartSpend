# SmartSpend — Personal Finance & Ledger Management Application

SmartSpend is a full-stack personal finance management web application built with **PostgreSQL**, decimal-safe accounting rules, explicit inter-account transfers, monthly category budgets with threshold alerts, savings goals, idempotent recurring transaction processing, CSV import/export validation, and financial reporting.

This repository includes:
1. **Live Cloud SQL PostgreSQL Web Application** (running on port `3000` in the interactive preview environment).
2. **Modular Python + Django + PostgreSQL Reference Codebase** (`smartspend_django/` & downloadable from the in-app **Help & Setup Guide** page) containing modular Django apps (`core`, `accounts`, `transactions`, `budgets`, `goals`, `recurring`, `reports`), Django ORM models, server-rendered Bootstrap 5 templates, forms, admin configurations, demo fixtures, and `manage.py test` suites.

---

## 1. PostgreSQL Setup Instructions

### macOS / Linux
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update && sudo apt install -y postgresql postgresql-contrib

# Or via Homebrew on macOS
brew install postgresql@16
brew services start postgresql@16

# Create database and role
psql -U postgres -c "CREATE USER smartspend_user WITH PASSWORD 'replace_with_strong_password';"
psql -U postgres -c "CREATE DATABASE smartspend_db OWNER smartspend_user;"
psql -U postgres -c "ALTER USER smartspend_user CREATEDB;"
```

### Windows (PowerShell)
```powershell
# After installing PostgreSQL 16 from postgresql.org:
psql -U postgres -c "CREATE USER smartspend_user WITH PASSWORD 'replace_with_strong_password';"
psql -U postgres -c "CREATE DATABASE smartspend_db OWNER smartspend_user;"
psql -U postgres -c "ALTER USER smartspend_user CREATEDB;"
```

---

## 2. Python & Django Setup Commands

### macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd smartspend_django
python manage.py makemigrations
python manage.py migrate
python manage.py check
python manage.py test
python manage.py loaddata fixtures/demo_smartspend.json
python manage.py createsuperuser
python manage.py runserver 8000
```

### Windows (PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd smartspend_django
python manage.py makemigrations
python manage.py migrate
python manage.py check
python manage.py test
python manage.py loaddata fixtures/demo_smartspend.json
python manage.py createsuperuser
python manage.py runserver 8000
```

---

## 3. Environment Variables Configuration

Set the following environment variables for the Django + PostgreSQL deployment:
- `DJANGO_SECRET_KEY`: High-entropy cryptographic secret key
- `DJANGO_DEBUG`: `True` in local development, `False` in production
- `DJANGO_ALLOWED_HOSTS`: Comma-separated hostnames (e.g., `localhost,127.0.0.1`)
- `SQL_HOST`: PostgreSQL host or Cloud SQL Auth Proxy socket path
- `SQL_DB_NAME`: Database name (`smartspend_db`)
- `SQL_USER`: Application PostgreSQL user (`smartspend_user`)
- `SQL_PASSWORD`: Application PostgreSQL password
- `SQL_PORT`: `5432`

---

## 4. Demo Data & Isolation Guarantee

- Demo fixtures (`fixtures/demo_smartspend.json` or the in-app **Reset / Load Demo Fixtures** button) create an isolated demo workspace (`demo@smartspend.app`) labeled with `[Demo]` descriptions.
- Demo records are strictly scoped by `user_id` foreign keys and are never mixed with other registered users' financial records.

---

## 5. Implemented Scope vs. Explicit Non-Goals

### Implemented Features
- **Public & Auth Views**: Landing page, Registration, Login (Email/Password + Google OAuth), Logout, Password Reset flow, Profile, Preferences, Security Settings, Help & Documentation, and 403 / 404 / 500 error views.
- **Accounts & Transfers**: Bank, Cash, and Digital Wallet accounts with opening balances, archived state, referential deletion protection, and explicit inter-account transfers that never double-count income or expenses.
- **Transactions & Validated CSV Import/Export**: Create, view, edit, delete with confirmation, search, multi-criteria filtering (date range, category, account, type), sorting, pagination, RFC-4180 CSV export, and validated CSV import with header check, malformed row reporting, invalid amount rejection, and duplicate hash detection.
- **Budgets & Savings Goals**: Monthly category budgets with customizable warning thresholds (default 80%), zero-budget boundary safety, savings goals with target dates, contribution ledger, and completion status.
- **Idempotent Recurring Rules**: Weekly, biweekly, monthly, quarterly, and yearly rules with `last_processed_date` idempotency guard and deterministic transaction hash (`recurring:<rule_id>:<due_date>`) to prevent duplicate generation.
- **Reports & Analytics**: Monthly and yearly cash flow charts, category spending breakdown, savings rate calculation, period comparisons, and downloadable CSV report summaries.

### Explicitly Unimplemented External Integrations
- **Live Bank Plaid / Open Banking Sync**: Not implemented; all accounts and transactions are managed via direct ledger entry, recurring rules, or CSV import.
- **Real Payment Rails / Wire Execution**: Transfers record ledger movements between user-tracked accounts and do not initiate external ACH or wire transfers.
