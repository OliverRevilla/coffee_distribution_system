# Coffee Distribution System - Architecture Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Authentication Flow](#authentication-flow)
4. [Web Frontend - Pages & Data Flow](#web-frontend---pages--data-flow)
   - [Login & Registration](#login--registration)
   - [Seller Dashboard](#seller-dashboard)
   - [Admin Dashboard](#admin-dashboard)
   - [Customer Management](#customer-management)
   - [Customer Tracking](#customer-tracking)
   - [Products Management](#products-management)
   - [Inventory Management](#inventory-management)
   - [Sales Management](#sales-management)
   - [Routes Management](#routes-management)
   - [Complaints Management](#complaints-management)
   - [Sellers Management](#sellers-management)
   - [Seller Profile](#seller-profile)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Shared Backend Modules](#shared-backend-modules)
7. [Seed Data](#seed-data)

---

## System Overview

A coffee bean distribution management system for a company operating in Lima, Peru. Two user roles exist: **admin** (full access) and **seller** (limited to own data).

```
web/ (React + Vite + Tailwind + Recharts + Leaflet)
  │  port 5173
  │  calls API via Axios (VITE_API_BASE_URL)
  ▼
api/ (Flask + psycopg2)
  │  port 7071
  │  reads DATABASE_URL env var
  ▼
PostgreSQL (Azure)
```

---

## Database Schema

All tables live in the `distribution` schema. Defined in `infrastructure/schema.sql`.

| Table | Purpose |
|---|---|
| `users` | Admin & seller accounts (email, password_hash, role, status, dni, phone, residency) |
| `products` | Admin product catalog (name, presentation, recommended_price, category) |
| `seller_products` | Seller picks products and sets own price (seller_id, product_id, real_price) |
| `customers` | Seller's customers (name, district, phone, payment_mode, cycle_days) |
| `coffee_variants` | Product catalog (name, SKU, price, category A/B/C) |
| `inventory` | Stock per variant (quantity, warehouse_location, reorder_point) |
| `sales` | Sale transactions (seller, customer, variant, quantity, total, GPS coords, date) |
| `routes` | Delivery routes (name, assigned_seller, status, date) |
| `route_waypoints` | Stops on a route (sequence, customer, address, GPS, status) |
| `gps_locations` | Seller GPS tracking history |
| `complaints` | Customer complaints (subject, category, priority, status) |

---

## Authentication Flow

1. User enters email + password on the login page
2. Frontend calls `POST /api/auth/login` with `{ email, password }`
3. Backend looks up user by email, verifies password with PBKDF2-SHA256
4. If valid and `status='active'`, returns a signed token + user object
5. Token is stored in `localStorage` (`auth_token` + `auth_user`)
6. Axios interceptor attaches `Authorization: Bearer <token>` to every request
7. On 401 response, interceptor clears localStorage and redirects to login

Token format: `base64(payload).sha256(base64(payload) + SECRET_KEY)` with 24h expiry.

Role-based access:
- `@require_auth` - any authenticated user
- `@require_admin` - admin role only
- Sellers see only their own sales, routes, complaints; admins see all

---

## Web Frontend - Pages & Data Flow

### Login & Registration

**Route:** `/login` → `LoginPage.tsx`

A role chooser with two buttons: "Sign in as Seller" and "Sign in as Admin". Links to registration.

**Route:** `/login/seller` → `SellerLoginPage.tsx`

Email + password form. Calls `POST /api/auth/login`. On success redirects to `/dashboard`.

**Route:** `/login/admin` → `AdminLoginPage.tsx`

Same form. If a non-admin logs in, redirects to seller login. On success redirects to `/admin`.

**Route:** `/register/seller` → `SellerRegisterPage.tsx`

Full name + email + password form with structured residency selects (Departamento → Provincia → Distrito). Calls `POST /api/auth/register/seller` (public endpoint, no auth required).

```
Pages: LoginPage, SellerLoginPage, AdminLoginPage, SellerRegisterPage
API: POST /api/auth/login, POST /api/auth/register/seller
```

---

### Seller Dashboard

**Route:** `/dashboard` → `web/src/pages/seller/DashboardPage.tsx`

Shows an overview of the seller's own performance with charts and a district bubble map.

**API calls on load (single Promise.all):**

```
┌─────────────────────────┐     ┌──────────────────────────┐
│ GET /api/routes         │     │ GET /api/sales           │
│ (filtered to seller)    │     │ (filtered to seller)     │
└────────────┬────────────┘     └────────────┬─────────────┘
             │                               │
             ▼                               ▼
     routes[]                           sales[]
```

**Summary cards (derived from API data):**

| Card | Calculation |
|---|---|
| Pending Routes | `routes.filter(r => r.status === 'pending').length` |
| Total Sales | `sales.length` |
| Total Revenue | `sales.reduce(sum + total_amount)` |

**Charts (all built with Recharts from the sales[] data):**

| Chart | Type | Data Source | What it shows |
|---|---|---|---|
| Sales Trend | LineChart | `sales` grouped by date | Revenue per day as a line |
| Sales by Product | BarChart | `sales` grouped by `variant_name` | Revenue per product as bars |
| Top 5 Clients | Horizontal BarChart | `sales` grouped by `customer_name` | Best customers by revenue |
| Sales by District | Leaflet circleMarkers | `sales` with GPS coords grouped by district | Bubble map showing sales distribution |

**Recent Sales table:** Last 10 sales with columns: Date, Product, Customer, Quantity, Total.

All transformations use `useMemo` to avoid recalculating on every render.

---

### Admin Dashboard

**Route:** `/admin` → `web/src/pages/admin/AdminDashboardPage.tsx`

Analytics view with 4 charts and a map.

**API calls on load (single Promise.all):**

```
┌──────────────────────────────┐     ┌──────────────────────────┐
│ GET /api/reports/sales       │     │ GET /api/sellers         │
│ Returns: { summary,          │     │ Returns: sellers[]       │
│   by_seller, by_variant,     │     └──────────────────────────┘
│   by_date }                  │
└──────────────┬───────────────┘     ┌──────────────────────────┐
               │                     │ GET /api/sales           │
               │                     │ (all sales with GPS)     │
      ┌────────┴────────┐            └────────────┬─────────────┘
      ▼                  ▼                        ▼
  summary    by_variant, by_date              sales[]
```

**Summary cards:**

| Card | Source |
|---|---|
| Total Sales | `summary.total_sales` |
| Total Revenue | `sales.reduce(sum + total_amount)` |
| Active Sellers | `sellers.filter(s => s.status === 'active').length` |
| Total Sellers | `sellers.length` |

**Charts:**

| Chart | Type | Data | What it shows |
|---|---|---|---|
| Sales Trend | LineChart | `by_date` (reversed to chronological) | Revenue per day over 30 days |
| Revenue by Product | BarChart (colored) | `by_variant` | Revenue per product variant |
| Top 10 Sales by Total | Horizontal BarChart | `sales` sorted by total_amount desc, top 10 | Largest individual sales |
| Most Frequent Sales Zones | Leaflet circleMarkers | `sales` grouped by 2-decimal GPS precision | Sales density zones across Lima |

```
Components: AdminDashboardPage, SalesZonesMap
API: GET /api/reports/sales, GET /api/sellers, GET /api/sales
```

---

### Customer Management

**Route:** `/customers` → `web/src/pages/seller/CustomersPage.tsx` (seller only)

**API calls:**

```
GET /api/sales  →  sales[] (to derive unique customers)
```

**Table columns:** Name, Address, District, Phone, DNI, RUC, Payment Mode, Cycle Days

---

### Customer Tracking

**Route:** `/tracking` → `web/src/pages/seller/TrackingPage.tsx` (seller only)

Tracks customer reorder cycles based on `cycle_days` and last sale date.

**API calls:**

```
GET /api/tracking/customers  →  tracking[]
```

**Table columns:** Customer, Last Sale, Next Expected, Days Since Last, Status

**Status logic:**
- Active: ≤ 90 days since last sale
- Inactive: > 90 days since last sale
- Overdue: next expected date has passed

**Filter tabs:** All / Active / Inactive / Overdue

**Summary cards:** Total Customers, Active, Inactive, Overdue

---

### Products Management

**Route:** `/admin/products` → `web/src/pages/admin/ProductsPage.tsx` (admin only)

Admin manages the product catalog with recommended prices.

**API calls:**

```
GET /api/products  →  products[]
```

**Table columns:** Name, Description, Presentation, Recommended Price, Category, Actions (Edit/Delete)

**Add Product modal:** name, description, presentation, recommended_price, category

---

**Route:** `/products` → `web/src/pages/seller/ProductsPage.tsx` (seller only)

Seller picks products from the catalog and sets their own price.

**API calls:**

```
GET /api/products           →  allProducts[] (admin catalog)
GET /api/seller/products    →  myProducts[] (seller's picks)
```

**Two sections:**

1. **My Active Products** — products the seller has picked, with editable real_price and margin display (margin = real_price - recommended_price = seller revenue)
2. **Available Products** — products not yet picked, with "Add" button

---

### Inventory Management

**Route:** `/admin/inventory` → `web/src/pages/admin/InventoryPage.tsx` (admin only)

**API calls:**

```
GET /api/inventory  →  items[] (with joined variant name, SKU, category)
```

**Table columns:** Variant, SKU, Category (color badge), Quantity, Warehouse, Reorder Point, Status

Status is computed: if `quantity <= reorder_point` → "Low Stock" (red), otherwise "In Stock" (green).

**Add Item modal** → calls `POST /api/inventory` with `{ variant_id, quantity, warehouse_location, reorder_point }`.

```
API: GET /api/inventory, POST /api/inventory
```

---

### Sales Management

**Route:** `/admin/sales` → `web/src/pages/admin/SalesPage.tsx` (admin only)

**Route:** `/sales` → `web/src/pages/seller/SalesPage.tsx` (seller only)

Both pages have identical features: filters + pagination.

**API calls:**

```
GET /api/sales  →  sales[] (all sales, admin sees everything; seller sees own)
```

**Filters (instant, client-side):**

| Filter | Type | Behavior |
|--------|------|----------|
| Year | Select (auto-populated from data) | Exact match |
| Month | Select (01-12) | Exact match |
| Day | Select (01-31) | Exact match |
| Customer | Text input | Partial match (case-insensitive) |
| District | Text input | Partial match (case-insensitive) |

- "Clear all" button resets all filters
- Page resets to 1 when any filter changes

**Pagination:**

- 100 rows per page
- Top and bottom controls: First / Prev / Page X of Y / Next / Last
- Shows result count ("X sales found")

**Table columns (admin):** Date, Seller, Customer, Variant, Qty, Unit Price, Total, District

**Table columns (seller):** Date, Customer, Variant, Qty, Unit Price, Total, District, Status

```
API: GET /api/sales
```

---

### Routes Management

**Route:** `/admin/routes` → `web/src/pages/admin/RoutesPage.tsx` (admin only)

**API calls:**

```
GET /api/routes   →  routes[] (all routes)
GET /api/sellers  →  sellers[] (for the seller dropdown)
```

**Table columns:** Name, Date, Assigned Seller, Status (color badge), Description

Status colors: pending → yellow, in_progress → blue, completed → green.

**Create Route modal:**
- Form fields: name, description, route_date, assigned_seller_id (dropdown of active sellers)
- Calls `POST /api/routes` with the route data

```
API: GET /api/routes, GET /api/sellers, POST /api/routes
```

---

### Complaints Management

**Route:** `/admin/complaints` → `web/src/pages/admin/ComplaintsPage.tsx` (admin only)

**API calls:**

```
GET /api/complaints  →  complaints[] (all complaints)
```

**Table columns:** Subject, Seller, Customer, Category, Priority (color badge), Status (color badge), Created

Priority colors: low → gray, medium → yellow, high → red.
Status colors: open → blue, in_progress → yellow, resolved → green, closed → gray.

**Resolve button** (on unresolved complaints) → calls `PUT /api/complaints/<id>/resolve`.

```
API: GET /api/complaints, PUT /api/complaints/<id>/resolve
```

---

### Sellers Management

**Route:** `/admin/sellers` → `web/src/pages/admin/SellersPage.tsx` (admin only)

**API calls:**

```
GET /api/sellers  →  sellers[]
```

**Table columns:** Name, Email, Role, Status (color badge), Created, Action

Action column: toggle button to activate/deactivate sellers via `PUT /api/sellers/<id>/status`.

**Add Seller modal:**
- Form fields: full_name, email, password, DNI, phone
- Structured residency: Departamento → Provincia → Distrito (Peru only)
- Calls `POST /api/auth/register` with `{ email, password, full_name, role: 'seller', dni, phone, residency }`

```
API: GET /api/sellers, POST /api/auth/register, PUT /api/sellers/<id>/status
```

---

### Seller Profile

**Route:** `/profile` → `web/src/pages/seller/ProfilePage.tsx` (seller only)

**API calls:**

```
GET /api/profile       →  profile data
PUT /api/profile       →  update profile
PUT /api/profile/password  →  change password
```

**Profile form:**
- Full name (editable)
- DNI (editable)
- Phone (editable)
- Structured residency: Departamento → Provincia → Distrito (Peru only)
- Email (read-only)

**Password change form:**
- Current password (required for verification)
- New password (minimum 6 characters)
- Confirm password

---

## API Endpoints Reference

All endpoints are in `api/app.py`. Base URL: `http://localhost:7071/api`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | None | Login with email + password |
| POST | `/auth/register/seller` | None | Public seller self-registration |
| POST | `/auth/register` | Admin | Admin creates any user |

### Profile

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile` | Auth | Get current user profile |
| PUT | `/profile` | Auth | Update profile (name, dni, phone, residency) |
| PUT | `/profile/password` | Auth | Change password (requires current password) |

### Sellers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sellers` | Admin | List all sellers |
| POST | `/sellers` | Admin | Create a seller |
| PUT | `/sellers/<id>` | Admin | Update seller info |
| PUT | `/sellers/<id>/status` | Admin | Toggle active/inactive |

### Products (Admin Catalog)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/products` | Admin | List all products |
| POST | `/products` | Admin | Create product |
| PUT | `/products/<id>` | Admin | Update product |
| DELETE | `/products/<id>` | Admin | Delete product |

### Seller Products

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/seller/products` | Auth | List seller's active products |
| POST | `/seller/products` | Auth | Add product to seller's catalog |
| PUT | `/seller/products/<id>` | Auth | Update seller's product price |
| DELETE | `/seller/products/<id>` | Auth | Remove product from seller's catalog |

### Customer Tracking

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tracking/customers` | Auth | Get customer reorder cycle tracking |

### Inventory

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/inventory` | Admin | List all inventory items |
| GET | `/inventory/<id>` | Admin | Get single item |
| POST | `/inventory` | Admin | Create inventory record |
| PUT | `/inventory/<id>` | Admin | Update quantity/location |

### Variants

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/variants` | Auth | List active coffee variants |
| POST | `/variants` | Admin | Create new variant |

### Sales

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sales` | Auth | List sales (admin: all, seller: own) |
| POST | `/sales` | Auth | Create a sale |
| GET | `/sales/<id>` | Auth | Get single sale |

### Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/routes` | Auth | List routes (admin: all, seller: assigned) |
| POST | `/routes` | Admin | Create route with waypoints |
| PUT | `/routes/<id>/assign` | Admin | Assign seller to route |
| POST | `/routes/<id>/checkin` | Auth | Seller checks in at waypoint |

### Tracking

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/tracking/location` | Auth | Record GPS ping |
| GET | `/tracking/seller/<id>` | Admin | Last 100 locations for seller |
| GET | `/tracking/seller/<id>/latest` | Admin | Most recent location |

### Complaints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/complaints` | Auth | List complaints (admin: all, seller: own) |
| POST | `/complaints` | Auth | Create complaint |
| PUT | `/complaints/<id>` | Admin | Update complaint |
| PUT | `/complaints/<id>/resolve` | Admin | Mark as resolved |

### Reports

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/reports/sales` | Admin | Aggregated sales analytics |

---

## Shared Backend Modules

| Module | File | Purpose |
|---|---|---|
| `shared/db.py` | Database connection singleton via psycopg2. Reads `DATABASE_URL` env var. Auto-rollbacks stale connections. |
| `shared/auth.py` | Password hashing (PBKDF2-SHA256), token creation/verification (HMAC-SHA256 signed base64). |
| `shared/models.py` | Pydantic data models and enums (UserRole, RouteStatus, ComplaintCategory, etc.). |

---

## Seed Data

**`seed_users.py`** - Creates test accounts:
- `admin@test.com` / `admin123` (role=admin)
- `seller@test.com` / `seller123` (role=seller)

**`seed_data.py`** - Populates realistic data:
- 6 coffee variants (categories A/B/C with real SKUs and prices)
- 8 products (admin catalog with recommended prices)
- 8 seller products (seller picks with marked-up prices)
- Inventory records for each variant
- 5 customers with cycle_days for reorder tracking
- 40 sales spread across 30 days with real Lima GPS coordinates
- 4 delivery routes with 4 waypoints each (Jesus Maria, Miraflores, San Isidro, Barranco, Surco)
- 4 complaints

Run with:
```bash
export DATABASE_URL="postgresql://..."
python seed_users.py
python seed_data.py
```
