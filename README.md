# Coffee Distribution System

A distribution management system for a coffee company with multiple sellers and two administrators. Tracks inventory, sales, complaints, and sales routes with GPS tracking. Includes dashboards with charts and interactive maps. Accessible from any device via web app.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Roles & Permissions](#roles--permissions)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [API Endpoints](#api-endpoints)
6. [Authentication](#authentication)
7. [Dashboard Features](#dashboard-features)
8. [Local Development Setup](#local-development-setup)
9. [Database Seeding](#database-seeding)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

| Aspect | Details |
|--------|---------|
| **Purpose** | Coffee distribution management for sellers and administrators |
| **Users** | 2 Administrators + up to 20 Sellers |
| **Access** | Web (React + Vite + TypeScript) from any device |
| **Tracking** | Real-time GPS tracking for delivery routes, customer reorder cycle tracking |
| **Backend** | Python Flask API (port 7071) |
| **Database** | PostgreSQL with `distribution` schema |
| **Frontend Charts** | Recharts library for analytics |
| **Maps** | Leaflet with OpenStreetMap for sales zones and district bubbles |
| **Product Catalog** | Admin-managed products with recommended prices, sellers set real prices |
| **Profile Management** | Sellers manage personal info, residency, and password |

---

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Administrator** | Full CRUD on inventory, products catalog (recommended prices), sales reports with charts, complaint management, route creation/assignment, seller management, analytics dashboards, sales zones map, top 10 sales view |
| **Seller** | View assigned routes, register sales, view own sales history and charts, submit complaints, GPS check-in at delivery points, manage profile, track customer reorder cycles, pick products and set prices, district bubble map |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React Web App (Vite + TypeScript)                        │   │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐   │   │
│  │  │  Seller Login    │  │  Admin Login                  │   │   │
│  │  │  /login/seller   │  │  /login/admin                 │   │   │
│  │  └─────────────────┘  └──────────────────────────────┘   │   │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐   │   │
│  │  │  Seller Register │  │  Admin Dashboard              │   │   │
│  │  │  /register/seller│  │  - Sales Trend (line)         │   │   │
│  │  └─────────────────┘  │  - Revenue by Product (bar)   │   │   │
│  │                       │  - Top 10 Sales (bar)          │   │   │
│  │  ┌─────────────────┐  │  - Sales Zones Map (Leaflet)  │   │   │
│  │  │  Seller Dashboard│  └──────────────────────────────┘   │   │
│  │  │  - Sales Charts  │  ┌──────────────────────────────┐   │   │
│  │  │  - Top Clients   │  │  Admin Pages                  │   │   │
│  │  │  - District Map  │  │  - Products (catalog)         │   │   │
│  │  └─────────────────┘  │  - Inventory (A/B/C)          │   │   │
│  │                       │  - Sales (filters+pagination)  │   │   │
│  │  ┌─────────────────┐  │  - Complaints                 │   │   │
│  │  │  Seller Pages    │  │  - Sellers                    │   │   │
│  │  │  - Tracking      │  │  - Profile                    │   │   │
│  │  │  - Products      │  └──────────────────────────────┘   │   │
│  │  │  - Sales         │                                     │   │
│  │  │  - Profile       │                                     │   │
│  │  └─────────────────┘                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/REST + Bearer Token
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API LAYER (Flask)                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Python Flask Server (port 7071)                          │   │
│  │  - Email/Password Authentication                         │   │
│  │  - HMAC-signed JWT Tokens                                │   │
│  │  - REST API Endpoints (25+ routes)                        │   │
│  │  - CORS enabled for localhost:5173                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database (distribution schema)                │   │
│  │  - Users (admin/seller roles, dni, phone, residency)     │   │
│  │  - Products (admin catalog, recommended prices)          │   │
│  │  - Seller Products (seller picks, real prices)           │   │
│  │  - Customers (cycle_days for reorder tracking)           │   │
│  │  - Coffee Variants (categories A/B/C, prices)            │   │
│  │  - Inventory (stock levels, reorder points)              │   │
│  │  - Sales (GPS coordinates, customer_id, presentation)    │   │
│  │  - Routes & Waypoints (Lima, Peru locations)             │   │
│  │  - GPS Locations (real-time tracking)                    │   │
│  │  - Complaints (open/in-progress/resolved)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Product Categories

| Category | Description | Price Range | Products |
|----------|-------------|-------------|----------|
| **A** | Premium - Highest quality, specialty origins | $15-17 | Etíope Yirgacheffe, Tueste Italiano |
| **B** | Standard - Medium quality, balanced flavors | $13-15 | Colombiano Supremo, Descafeinado Casa |
| **C** | Economy - Everyday coffee, best value | $11-13 | Espresso Blend, Tueste Francés |

### Tables

```sql
-- Users table (with profile fields)
CREATE TABLE distribution.users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(256) NOT NULL UNIQUE,
    full_name       VARCHAR(256) NOT NULL,
    password_hash   VARCHAR(512),
    role            VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    dni             VARCHAR(20),
    phone           VARCHAR(50),
    residency       VARCHAR(256),
    azure_b2c_id    VARCHAR(256) DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coffee variants with categories
CREATE TABLE distribution.coffee_variants (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    sku             VARCHAR(50) NOT NULL UNIQUE,
    price           DECIMAL(10,2) NOT NULL,
    category        VARCHAR(1) NOT NULL DEFAULT 'C' CHECK (category IN ('A', 'B', 'C')),
    image_url       VARCHAR(512),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products catalog (admin manages, sellers pick from)
CREATE TABLE distribution.products (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(256) NOT NULL,
    description         TEXT,
    presentation        VARCHAR(50) NOT NULL,
    recommended_price   DECIMAL(10,2) NOT NULL,
    category            VARCHAR(1) DEFAULT 'C' CHECK (category IN ('A', 'B', 'C')),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seller product assignments (seller picks products and sets their own price)
CREATE TABLE distribution.seller_products (
    id                  SERIAL PRIMARY KEY,
    seller_id           INT NOT NULL REFERENCES distribution.users(id),
    product_id          INT NOT NULL REFERENCES distribution.products(id),
    real_price          DECIMAL(10,2) NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_id, product_id)
);

-- Customers (with reorder cycle tracking)
CREATE TABLE distribution.customers (
    id              SERIAL PRIMARY KEY,
    seller_id       INT NOT NULL REFERENCES distribution.users(id),
    name            VARCHAR(256) NOT NULL,
    nickname        VARCHAR(256),
    address         VARCHAR(512),
    district        VARCHAR(100),
    phone           VARCHAR(50),
    dni             VARCHAR(20),
    ruc             VARCHAR(20),
    payment_mode    VARCHAR(10) NOT NULL DEFAULT 'cash'
                    CHECK (payment_mode IN ('cash', 'credit')),
    cycle_days      INT NOT NULL DEFAULT 30,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory tracking
CREATE TABLE distribution.inventory (
    id                  SERIAL PRIMARY KEY,
    variant_id          INT NOT NULL REFERENCES distribution.coffee_variants(id),
    quantity            INT NOT NULL DEFAULT 0,
    warehouse_location  VARCHAR(256),
    reorder_point       INT DEFAULT 10,
    last_updated        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by          INT REFERENCES distribution.users(id)
);

-- Sales records
CREATE TABLE distribution.sales (
    id                      SERIAL PRIMARY KEY,
    seller_id               INT NOT NULL REFERENCES distribution.users(id),
    customer_id             INT REFERENCES distribution.customers(id),
    variant_id              INT NOT NULL REFERENCES distribution.coffee_variants(id),
    presentation            VARCHAR(20) NOT NULL DEFAULT 'granel'
                            CHECK (presentation IN ('granel', '250gr', '1kg')),
    quantity                INT NOT NULL CHECK (quantity BETWEEN 1 AND 100),
    unit_price              DECIMAL(10,2) NOT NULL,
    total_amount            DECIMAL(10,2) NOT NULL,
    sale_date               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_date            TIMESTAMP,
    expected_payment_date   TIMESTAMP,
    partial_payments        DECIMAL(10,2) DEFAULT 0,
    remanent_payment        DECIMAL(10,2) DEFAULT 0,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed')),
    notes                   TEXT,
    gps_latitude            DECIMAL(9,6),
    gps_longitude           DECIMAL(9,6),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery routes
CREATE TABLE distribution.routes (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(256) NOT NULL,
    description         TEXT,
    assigned_seller_id  INT REFERENCES distribution.users(id),
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed')),
    route_date          DATE NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route waypoints (delivery stops)
CREATE TABLE distribution.route_waypoints (
    id                  SERIAL PRIMARY KEY,
    route_id            INT NOT NULL REFERENCES distribution.routes(id) ON DELETE CASCADE,
    sequence            INT NOT NULL,
    customer_name       VARCHAR(256),
    address             VARCHAR(512),
    latitude            DECIMAL(9,6) NOT NULL,
    longitude           DECIMAL(9,6) NOT NULL,
    estimated_arrival   TIMESTAMP,
    actual_arrival      TIMESTAMP,
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'visited', 'skipped')),
    notes               TEXT
);

-- GPS location tracking
CREATE TABLE distribution.gps_locations (
    id          BIGSERIAL PRIMARY KEY,
    seller_id   INT NOT NULL REFERENCES distribution.users(id),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    accuracy    DECIMAL(5,2),
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints
CREATE TABLE distribution.complaints (
    id              SERIAL PRIMARY KEY,
    seller_id       INT NOT NULL REFERENCES distribution.users(id),
    customer_name   VARCHAR(256),
    subject         VARCHAR(256) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(50) CHECK (category IN ('quality', 'delivery', 'pricing', 'other')),
    status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority        VARCHAR(10) DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP,
    resolution_notes TEXT
);
```

### Database Migration

If you have an existing database without the newer columns:

```sql
-- Add profile fields to users
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS residency VARCHAR(256);

-- Add cycle_days to customers
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS cycle_days INT NOT NULL DEFAULT 30;

-- Add GPS and customer reference to sales
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES distribution.customers(id);
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS presentation VARCHAR(20) NOT NULL DEFAULT 'granel';
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(9,6);
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(9,6);
```

---

## API Endpoints

All endpoints are served via Flask (Python) on port 7071.

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/login` | Login with email/password | Public |
| POST | `/api/auth/register/seller` | Register as seller | Public |
| POST | `/api/auth/register` | Create user (admin only) | Admin |

### Profile
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/profile` | Get current user profile | Seller |
| PUT | `/api/profile` | Update profile (name, dni, phone, residency) | Seller |
| PUT | `/api/profile/password` | Change password (requires current password) | Seller |

### Products Catalog
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/products` | List all products | Admin |
| POST | `/api/products` | Create product | Admin |
| PUT | `/api/products/{id}` | Update product | Admin |
| DELETE | `/api/products/{id}` | Delete product | Admin |
| GET | `/api/seller/products` | List seller's active products | Seller |
| POST | `/api/seller/products` | Add product to seller's catalog | Seller |
| PUT | `/api/seller/products/{id}` | Update seller's product price | Seller |
| DELETE | `/api/seller/products/{id}` | Remove product from seller's catalog | Seller |

### Customer Tracking
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/tracking/customers` | Get customer reorder cycle tracking | Seller |

### Inventory
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/inventory` | List all inventory items (with category) | Admin |
| GET | `/api/inventory/{id}` | Get single item | Admin |
| POST | `/api/inventory` | Add new inventory | Admin |
| PUT | `/api/inventory/{id}` | Update inventory | Admin |
| GET | `/api/variants` | List coffee variants (with category, sorted by category) | All |
| POST | `/api/variants` | Add new variant (with category) | Admin |

### Sales
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/sales` | List sales (filtered by role, with filters + pagination) | All |
| POST | `/api/sales` | Register a sale | Seller |
| GET | `/api/sales/{id}` | Get sale details | All (own data) |
| GET | `/api/reports/sales` | Sales reports/analytics | Admin |

### Routes & GPS
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/routes` | List routes | All |
| POST | `/api/routes` | Create route with waypoints | Admin |
| PUT | `/api/routes/{id}/assign` | Assign route to seller | Admin |
| POST | `/api/tracking/location` | Update seller GPS location | Seller |
| GET | `/api/tracking/seller/{id}` | Get seller location history | Admin |
| GET | `/api/tracking/seller/{id}/latest` | Get seller latest location | Admin |
| POST | `/api/routes/{id}/checkin` | Check in at waypoint | Seller |

### Complaints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/complaints` | List complaints | All (filtered) |
| POST | `/api/complaints` | Submit complaint | Seller |
| PUT | `/api/complaints/{id}` | Update complaint status | Admin |
| PUT | `/api/complaints/{id}/resolve` | Resolve complaint | Admin |

### Sellers (Admin Only)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/sellers` | List all sellers | Admin |
| POST | `/api/sellers` | Create seller account | Admin |
| PUT | `/api/sellers/{id}` | Update seller | Admin |
| PUT | `/api/sellers/{id}/status` | Activate/deactivate | Admin |

---

## Authentication

### Login Pages

| Page | URL | Target |
|------|-----|--------|
| Landing page | `/login` | Choose seller or admin |
| Seller login | `/login/seller` | Redirects to `/dashboard` |
| Admin login | `/login/admin` | Redirects to `/admin` |
| Seller register | `/register/seller` | Public registration |

### Login Flow

1. User navigates to `/login/seller` or `/login/admin`
2. Enters email + password
3. Backend verifies password against PBKDF2-SHA256 hash
4. HMAC-signed token returned (24h expiry)
5. Token stored in localStorage
6. Token sent with every API request via `Authorization: Bearer` header
7. Role-based redirect after login

### User Registration

- **Sellers**: Self-register at `/register/seller` (public, no restrictions)
- **Admins**: Created only by existing admins via the `/admin/sellers` page

### Password Security

- Passwords hashed with PBKDF2-SHA256 (100,000 iterations)
- Random 16-byte salt per password
- Stored as `{salt}${hex_hash}`
- Constant-time comparison via `hmac.compare_digest` to prevent timing attacks

---

## Dashboard Features

### Admin Dashboard (`/admin`)

| Feature | Description |
|---------|-------------|
| **Summary Cards** | Total sales, revenue, active sellers, total sellers |
| **Sales Trend Chart** | Line chart showing revenue over last 30 days |
| **Revenue by Product** | Bar chart showing revenue per product variant |
| **Top 10 Sales by Total** | Horizontal bar chart showing largest individual sales |
| **Most Frequent Sales Zones** | Interactive Leaflet map with circleMarkers sized by sales count per district in Lima, Peru |

### Seller Dashboard (`/dashboard`)

| Feature | Description |
|---------|-------------|
| **Summary Cards** | Pending routes, total sales, total revenue |
| **Sales Trend Chart** | Line chart showing personal revenue over time |
| **Sales by Product** | Bar chart showing revenue per product |
| **Top 5 Clients** | Horizontal bar chart showing best customers by revenue |
| **Sales by District** | Interactive Leaflet bubble map showing sales distribution across Lima districts |
| **Recent Sales Table** | Last 10 sales with date, product, customer, qty, total |

### Sales Zones Map

- **Technology**: Leaflet with OpenStreetMap tiles
- **Visualization**: Bubble markers sized by number of sales
- **Location**: Centered on Lima, Peru (-12.05, -77.03)
- **Aggregation**: Sales grouped by 2-decimal GPS precision into zones
- **Interactivity**: Click bubbles to see sales count and revenue
- **Color**: Amber (#f59e0b) with opacity based on density

### District Bubble Map

- **Technology**: Leaflet with OpenStreetMap tiles
- **Visualization**: CircleMarkers sized by sales count per district
- **Location**: 22 Lima districts pre-mapped with coordinates
- **Interactivity**: Hover to see district name and sale count

### Inventory Page Features

- Shows product category with color-coded badges
  - **A** (Premium): Purple badge
  - **B** (Standard): Blue badge
  - **C** (Economy): Gray badge
- Stock status indicators (In Stock / Low Stock)
- Warehouse location tracking

### Customer Tracking Features

- Last sale date and next expected date (based on cycle_days)
- Days since last sale
- Status indicators: Active (≤90 days), Inactive (>90 days)
- Filter tabs for All / Active / Inactive / Overdue

### Products Features

- **Admin**: Full CRUD on product catalog with recommended prices
- **Seller**: Pick products from catalog, set own real price, view margin (real - recommended = seller revenue)

### Profile Features

- Personal info: full name, DNI, phone
- Structured residency: Departamento → Provincia → Distrito (Peru only)
- Password change with current password verification

### Sales Filters & Pagination

- **Filters**: Year, Month, Day, Customer Name, District (instant client-side)
- **Pagination**: 100 rows per page with First / Prev / Next / Last controls
- **Available on**: Both admin and seller Sales pages

---

## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for PostgreSQL)

### 1. Clone and Setup

```bash
git clone <REPO_URL>
cd coffee_distribution_system
```

### 2. Start PostgreSQL with Docker

```bash
docker run -d \
  --name cafe-postgres \
  -e POSTGRES_USER=cafeadmin \
  -e POSTGRES_PASSWORD=localdev123 \
  -e POSTGRES_DB=cafe_distribution \
  -p 5432:5432 \
  postgres:16
```

### 3. Apply Schema

```bash
export DATABASE_URL="postgresql://cafeadmin:localdev123@localhost:5432/cafe_distribution"
psql $DATABASE_URL -f infrastructure/schema.sql
```

### 4. Seed Test Data

```bash
python seed_users.py
python seed_data.py
```

### 5. Start API

```bash
cd api
pip install -r requirements.txt
export DATABASE_URL="postgresql://cafeadmin:localdev123@localhost:5432/cafe_distribution"
export AUTH_SECRET_KEY="my-local-dev-key"
python app.py
```

API runs at `http://localhost:7071`

### 6. Start Frontend

```bash
cd web
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### 7. Login

- **Seller**: `http://localhost:5173/login/seller`
  - Email: `seller@test.com` / Password: `seller123`
- **Admin**: `http://localhost:5173/login/admin`
  - Email: `admin@test.com` / Password: `admin123`

### 8. Stop PostgreSQL

```bash
docker stop cafe-postgres
docker rm cafe-postgres
```

---

## Database Seeding

### seed_users.py

Creates initial admin and test seller users:

| Email | Password | Role |
|-------|----------|------|
| `admin@test.com` | `admin123` | admin |
| `seller@test.com` | `seller123` | seller |

### seed_data.py

Creates test data with Lima, Peru locations:

| Data | Records | Details |
|------|---------|---------|
| Coffee Variants | 6 | Categories A ($15-17), B ($13-15), C ($11-13) |
| Products | 8 | Admin catalog with recommended prices |
| Seller Products | 8 | Seller picks with marked-up prices |
| Inventory | 6 | Stock for each variant (20-200 units) |
| Customers | 5 | With cycle_days for reorder tracking |
| Sales | 40 | Spread across 30 days with GPS coordinates |
| Routes | 4 | With GPS waypoints in Lima districts |
| Waypoints | 16 | Real addresses in Lima, Peru |
| Complaints | 4 | Different statuses and priorities |

#### Lima Districts in Seed Data

| Route | Districts | Waypoints |
|-------|-----------|-----------|
| Ruta Jesús María - Miraflores | Jesús María, Miraflores | 4 stops |
| Ruta San Isidro - Barranco | San Isidro, Barranco | 4 stops |
| Ruta San Borja - Surco | San Borja, Surco, La Molina | 4 stops |
| Ruta Pueblo Libre - Lince | Pueblo Libre, Lince, Magdalena, Breña | 4 stops |

#### Customer Locations

Sales are recorded at GPS coordinates across 22 Lima districts:
Jesús María, Miraflores, San Isidro, Barranco, San Borja, Surco, La Molina, Pueblo Libre, Lince, Magdalena del Mar, San Miguel, Breña, Cercado de Lima, Rímac, Los Olivos, Ate, Comas, San Juan de Lurigancho, Villa El Salvador, Villa María del Triunfo, Santa Anita, Chaclacayo

```bash
export DATABASE_URL="postgresql://..."
python seed_data.py
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 18.2 |
| Build Tool | Vite | 5.0 |
| Language | TypeScript | 5.2 |
| Styling | Tailwind CSS | 3.3 |
| Charts | Recharts | 3.10 |
| Maps | Leaflet + OpenStreetMap | 1.9 |
| HTTP Client | Axios | 1.6 |
| Routing | React Router DOM | 6.20 |
| Backend | Flask | 3.x |
| CORS | Flask-CORS | - |
| Database | PostgreSQL | 16 |
| DB Driver | psycopg2-binary | - |

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `DATABASE_URL not configured` | Set the environment variable before running |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| `column cv.category does not exist` | Run the ALTER TABLE migration SQL |
| `InFailedSqlTransaction` | Restart the Flask server |
| CORS errors | Restart Flask server (CORS configured for localhost:5173) |
| Charts not loading | Run `cd web && rm -rf node_modules/.vite && npm run dev` |
| Map not showing | Restart frontend, check Leaflet CSS loads |
| Port 7071 in use | Change port in `api/app.py` or kill existing process |
| `current transaction is aborted` | Restart Flask server to reset connection |
| API connection refused (production) | Azure Consumption plan cold start — first request takes 30-60 seconds |
| Frontend shows localhost errors | Ensure `VITE_API_BASE_URL` was set during build |

### Quick Commands

```bash
# Restart API
cd api && python app.py

# Restart Frontend
cd web && npm run dev

# Clear Vite cache
cd web && rm -rf node_modules/.vite && npm run dev

# Re-seed database (users + test data)
python seed_users.py && python seed_data.py

# Type check frontend
cd web && npm run typecheck

# Lint frontend
cd web && npm run lint

# Lint API
cd api && flake8 . --max-line-length=120
```

### Frontend Routes

| URL | Page | Access |
|-----|------|--------|
| `/login` | Landing page (choose role) | Public |
| `/login/seller` | Seller login | Public |
| `/login/admin` | Admin login | Public |
| `/register/seller` | Seller registration | Public |
| `/dashboard` | Seller dashboard | Seller |
| `/customers` | Customer management | Seller |
| `/tracking` | Customer reorder tracking | Seller |
| `/products` | Seller product catalog | Seller |
| `/sales` | Sales list + filters + pagination | Seller |
| `/profile` | Seller profile | Seller |
| `/admin` | Admin dashboard | Admin |
| `/admin/products` | Product catalog management | Admin |
| `/admin/inventory` | Inventory management | Admin |
| `/admin/sales` | Sales list + filters + pagination | Admin |
| `/admin/complaints` | Complaints management | Admin |
| `/admin/sellers` | Seller management | Admin |

---

## GitHub Actions Secrets

**3 secrets** are needed for CD deployment:

| Secret Name | How to get it |
|-------------|---------------|
| `AZURE_PROD_PUBLISH_PROFILE` | `az webapp deployment list-publishing-profiles --name "cafe-dist-production-api" --resource-group "coffee-distribution-rg" --xml` |
| `AZURE_PROD_STATIC_WEB_APPS_TOKEN` | Azure Portal → Static Web App → Manage deployment tokens |
| `AZURE_DATABASE_URL` | `az webapp config appsettings list --name cafe-dist-production-api --resource-group coffee-distribution-rg --query "[?name=='DATABASE_URL'].value" -o tsv` |

### Where to configure

GitHub → Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

See [DEVOPS.md](DEVOPS.md) for full deployment instructions.

---

## License

Internal use only. All rights reserved.
