# Shoe Store Ecommerce Backend

API-first Django ecommerce backend for a shoe store. It includes customer auth, catalog search, carts, favorites, reviews, checkout, M-Pesa STK payments, order tracking, support messaging, notifications, a staff dashboard API, and a full Django Admin setup.

## Stack

- Django 5 + Django REST Framework
- PostgreSQL target database, with SQLite fallback for local smoke tests
- JWT auth with email-based users
- M-Pesa Daraja STK Push integration with local simulation mode
- Redis/Celery configuration for async jobs
- drf-spectacular OpenAPI docs

## Local Setup

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver
```

API docs are available at:

- `GET /api/schema/`
- `GET /api/docs/`

## React Storefront

The customer frontend lives in `frontend/` and talks to this Django API.

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

The frontend implements Home, About, Shop, Product Detail, Contact, Login/Register, Cart, Checkout, Favorites, Support, and Order Tracking. The user-flow map is in `docs/frontend-user-flow.md`.

Staff users can open the React admin UI at `http://127.0.0.1:3000/admin`. It consumes the same Django APIs for dashboard metrics, users, orders, products, support tickets, and review moderation.

Default demo staff account from `seed_demo`:

- Email: `admin@example.com`
- Password: `AdminPass123!`

## PostgreSQL

Start Postgres and Redis:

```bash
docker compose up -d
```

Use this in `.env`:

```env
DATABASE_URL=postgres://shoe_store:shoe_store@localhost:5432/shoe_store
REDIS_URL=redis://localhost:6379/0
```

The catalog migrations enable `pg_trgm` on PostgreSQL for search. Product search ranks matches across name, description, style, category, brand, and tags, then favors rating, sales, and popularity.

## Main API Areas

- Auth: `POST /api/auth/register/`, `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `GET/PATCH /api/auth/me/`
- Catalog: `GET /api/products/?q=best+shoes+of+men`, `GET /api/categories/`, `GET /api/brands/`
- Favorites: `POST /api/products/{slug}/favorite/`, `DELETE /api/products/{slug}/favorite/`, `GET /api/favorites/`
- Cart: `GET /api/cart/current/`, `POST /api/cart/add_item/`, `PATCH /api/cart/update_item/`, `DELETE /api/cart/remove_item/`
- Checkout: `POST /api/checkout/`
- Orders: `GET /api/orders/`, `GET /api/orders/{number}/track/`, `POST /api/orders/{number}/cancel/`
- Payments: `GET /api/payments/`, `POST /api/payments/mpesa/callback/`
- Reviews: `POST /api/reviews/`, staff approval at `POST /api/reviews/{id}/approve/`
- Support: `POST /api/support/tickets/`, `POST /api/support/tickets/{id}/reply/`
- Notifications: `GET /api/notifications/`, `POST /api/notifications/{id}/mark_read/`
- Staff dashboard: `GET /api/admin/dashboard/`

## Cart Tokens

Anonymous clients should store the returned `token` from `GET /api/cart/current/` and send it back as:

```http
X-Cart-Token: <uuid>
```

When the customer logs in, the anonymous cart is merged into the authenticated active cart automatically.

## M-Pesa

Local development uses simulation by default:

```env
MPESA_SIMULATE=True
```

For real Daraja calls, set:

```env
MPESA_SIMULATE=False
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback/
```

Successful callbacks mark orders paid. Failed callbacks mark pending-payment orders cancelled and release stock.

## Verification

```bash
.venv/bin/python manage.py check
.venv/bin/python -m pytest
```
