# Coffee Distribution System - Azure Cloud Architecture

A cloud-based distribution management system for a coffee company with multiple sellers and two administrators. Tracks inventory, sales, complaints, and sales routes with GPS tracking. Accessible from any device via web and mobile apps.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Roles & Permissions](#roles--permissions)
3. [Architecture Diagram](#architecture-diagram)
4. [Azure Services](#azure-services)
5. [Data Model](#data-model)
6. [API Endpoints](#api-endpoints)
7. [Security & Sensitive Information](#security--sensitive-information)
8. [DevSecOps Pipeline](#devsecops-pipeline)
9. [Implementation Phases](#implementation-phases)
10. [Local Development Setup](#local-development-setup)
11. [Troubleshooting](#troubleshooting)

---

## System Overview

| Aspect | Details |
|--------|---------|
| **Purpose** | Coffee distribution management for sellers and administrators |
| **Users** | 2 Administrators + up to 20 Sellers |
| **Access** | Web (React) + Mobile (React Native) from any device |
| **Tracking** | Real-time GPS tracking for delivery routes |
| **Budget** | ~$14/month estimated Azure cost |

---

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Administrator** (x2) | Full CRUD on inventory, sales reports, complaint management, route creation/assignment, seller management, analytics dashboards |
| **Seller** (up to 20) | View assigned routes, register sales, view own sales history, submit complaints, GPS check-in at delivery points |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  React Web   │  │ React Native │  │  Azure AD B2C            │  │
│  │  App (Admin) │  │ Mobile App   │  │  Authentication          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
└─────────┼─────────────────┼──────────────────────┼──────────────────┘
          │                 │                      │
          ▼                 ▼                      │
┌─────────────────────────────────────────┐       │
│       Azure Static Web Apps             │       │
│  ┌─────────────────────────────────┐    │       │
│  │  Azure Functions (Python)       │◄───┘       │
│  │  - API Endpoints                │            │
│  │  - GPS Tracking Functions       │            │
│  │  - Scheduled Jobs               │            │
│  └────────────────┬────────────────┘            │
└───────────────────┼─────────────────────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│  Azure SQL       │  │  Azure Maps      │
│  Database        │  │  Service         │
│  (~$5/month)     │  │  (GPS Tracking)  │
└──────────────────┘  └──────────────────┘
```

---

## Azure Services

| Service | Purpose | Tier | Est. Cost |
|---------|---------|------|-----------|
| **Azure AD B2C** | Authentication & role-based access | Free | $0 (50K auths/month) |
| **Azure Static Web Apps** | React hosting + CI/CD + integrated API | Standard | $9/month |
| **Azure Functions** | Serverless Python API | Consumption | ~$0 (1M free requests) |
| **Azure SQL Database** | Relational data store | Basic | ~$5/month |
| **Azure Maps** | GPS tracking & route visualization | Free | $0 (1K txns/day) |
| **Azure Key Vault** | Secrets management | Standard | ~$0 ( ops) |
| **Total** | | | **~$14/month** |

---

## Data Model

```sql
-- Users table (synced from Azure AD B2C)
CREATE TABLE Users (
    id              INT PRIMARY KEY IDENTITY,
    email           NVARCHAR(256) NOT NULL UNIQUE,
    full_name       NVARCHAR(256) NOT NULL,
    role            NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller')),
    status          NVARCHAR(20) NOT NULL DEFAULT 'active',
    azure_b2c_id    NVARCHAR(256) NOT NULL UNIQUE,
    created_at      DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Coffee variants
CREATE TABLE CoffeeVariants (
    id              INT PRIMARY KEY IDENTITY,
    name            NVARCHAR(256) NOT NULL,
    description     NVARCHAR(MAX),
    sku             NVARCHAR(50) NOT NULL UNIQUE,
    price           DECIMAL(10,2) NOT NULL,
    image_url       NVARCHAR(512),
    is_active       BIT DEFAULT 1,
    created_at      DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Inventory tracking
CREATE TABLE Inventory (
    id                  INT PRIMARY KEY IDENTITY,
    variant_id          INT NOT NULL REFERENCES CoffeeVariants(id),
    quantity            INT NOT NULL DEFAULT 0,
    warehouse_location  NVARCHAR(256),
    reorder_point       INT DEFAULT 10,
    last_updated        DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_by          INT REFERENCES Users(id)
);

-- Sales records
CREATE TABLE Sales (
    id              INT PRIMARY KEY IDENTITY,
    seller_id       INT NOT NULL REFERENCES Users(id),
    variant_id      INT NOT NULL REFERENCES CoffeeVariants(id),
    quantity        INT NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    total_amount    DECIMAL(10,2) NOT NULL,
    customer_name   NVARCHAR(256),
    customer_address NVARCHAR(512),
    gps_latitude    DECIMAL(9,6),
    gps_longitude   DECIMAL(9,6),
    sale_date       DATETIME2 DEFAULT SYSUTCDATETIME(),
    notes           NVARCHAR(MAX)
);

-- Delivery routes
CREATE TABLE Routes (
    id                  INT PRIMARY KEY IDENTITY,
    name                NVARCHAR(256) NOT NULL,
    description         NVARCHAR(MAX),
    assigned_seller_id  INT REFERENCES Users(id),
    status              NVARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed')),
    route_date          DATE NOT NULL,
    created_at          DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Route waypoints (delivery stops)
CREATE TABLE RouteWaypoints (
    id                  INT PRIMARY KEY IDENTITY,
    route_id            INT NOT NULL REFERENCES Routes(id) ON DELETE CASCADE,
    sequence            INT NOT NULL,
    customer_name       NVARCHAR(256),
    address             NVARCHAR(512),
    latitude            DECIMAL(9,6) NOT NULL,
    longitude           DECIMAL(9,6) NOT NULL,
    estimated_arrival   DATETIME2,
    actual_arrival      DATETIME2,
    status              NVARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'visited', 'skipped')),
    notes               NVARCHAR(MAX)
);

-- GPS location tracking
CREATE TABLE GPSLocations (
    id          BIGINT PRIMARY KEY IDENTITY,
    seller_id   INT NOT NULL REFERENCES Users(id),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    accuracy    DECIMAL(5,2),
    timestamp   DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Complaints
CREATE TABLE Complaints (
    id              INT PRIMARY KEY IDENTITY,
    seller_id       INT NOT NULL REFERENCES Users(id),
    customer_name   NVARCHAR(256),
    subject         NVARCHAR(256) NOT NULL,
    description     NVARCHAR(MAX) NOT NULL,
    category        NVARCHAR(50) CHECK (category IN ('quality', 'delivery', 'pricing', 'other')),
    status          NVARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority        NVARCHAR(10) DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    created_at      DATETIME2 DEFAULT SYSUTCDATETIME(),
    resolved_at     DATETIME2,
    resolution_notes NVARCHAR(MAX)
);
```

---

## API Endpoints

All endpoints are served via Azure Functions (Python) and require Azure AD B2C authentication.

### Inventory
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/inventory` | List all inventory items | Admin |
| GET | `/api/inventory/{id}` | Get single item | Admin |
| POST | `/api/inventory` | Add new inventory | Admin |
| PUT | `/api/inventory/{id}` | Update inventory | Admin |
| GET | `/api/variants` | List coffee variants | All |
| POST | `/api/variants` | Add new variant | Admin |

### Sales
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/sales` | List sales (filtered by role) | All |
| POST | `/api/sales` | Register a sale | Seller |
| GET | `/api/sales/{id}` | Get sale details | All (own data) |
| GET | `/api/reports/sales` | Sales reports/analytics | Admin |

### Routes & GPS
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/routes` | List routes | All |
| POST | `/api/routes` | Create route | Admin |
| PUT | `/api/routes/{id}/assign` | Assign route to seller | Admin |
| POST | `/api/tracking/location` | Update seller GPS location | Seller |
| GET | `/api/tracking/seller/{id}` | Get seller location history | Admin |
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

## Security & Sensitive Information

### CRITICAL: Sensitive Data Handling

> **WARNING**: Never commit real secrets, keys, passwords, or connection strings to version control.
> All sensitive values are managed through Azure Key Vault and GitHub Secrets.

### Secrets Required (Stored in Azure Key Vault + GitHub Secrets)

| Secret Name | Description | Where Used |
|-------------|-------------|------------|
| `AZURE_SQL_CONNECTION_STRING` | Azure SQL Database connection string | Azure Functions App Settings |
| `AZURE_B2C_TENANT_NAME` | Azure AD B2C tenant identifier | Azure Functions + Static Web Apps |
| `AZURE_B2C_CLIENT_ID` | App registration client ID | Azure Functions + Static Web Apps |
| `AZURE_B2C_CLIENT_SECRET` | App registration client secret | Azure Functions App Settings |
| `AZURE_B2C_POLICY_NAME` | Sign-up/sign-in user flow name | Static Web Apps config |
| `AZURE_MAPS_SUBSCRIPTION_KEY` | Azure Maps API key | Azure Functions App Settings |
| `AZURE_WEBPUBSUB_CONNECTION_STRING` | Real-time GPS updates (optional) | Azure Functions App Settings |

### Where Secrets Are Stored

```
┌─────────────────────────────────────────────────────────┐
│                  SECRETS FLOW                           │
│                                                         │
│  Developer Local ──► GitHub Secrets (CI/CD)             │
│         │                    │                          │
│         ▼                    ▼                          │
│  .env (gitignored)    Azure DevOps Pipeline            │
│                             │                          │
│                             ▼                          │
│                    Azure Key Vault                     │
│                        │    │                          │
│                        ▼    ▼                          │
│               Azure Functions    Azure Static Web Apps │
│               App Settings       App Settings          │
└─────────────────────────────────────────────────────────┘
```

### .gitignore Rules

The following files are **NEVER** committed:

```
# Environment and secrets
.env
.env.local
.env.production
*.pem
*.key

# Azure
azure-functions/**/local.settings.json

# Node modules
node_modules/
web/node_modules/
mobile/node_modules/
api/**/__pycache__/

# Build outputs
dist/
build/
*.log
```

### Azure Key Vault Setup

1. Create Key Vault via Azure Portal or CLI:
   ```bash
   az keyvault create \
     --name "cafe-dist-keyvault" \
     --resource-group "cafe-dist-rg" \
     --location "eastus" \
     --sku standard
   ```

2. Store secrets (replace with actual values):
   ```bash
   az keyvault secret set --vault-name "cafe-dist-keyvault" --name "AZURE-SQL-CONNECTION-STRING" --value "<YOUR_CONNECTION_STRING>"
   az keyvault secret set --vault-name "cafe-dist-keyvault" --name "AZURE-B2C-CLIENT-ID" --value "<YOUR_CLIENT_ID>"
   az keyvault secret set --vault-name "cafe-dist-keyvault" --name "AZURE-B2C-CLIENT-SECRET" --value "<YOUR_CLIENT_SECRET>"
   az keyvault secret set --vault-name "cafe-dist-keyvault" --name "AZURE-MAPS-KEY" --value "<YOUR_MAPS_KEY>"
   ```

3. Grant Azure Functions managed identity access to Key Vault:
   ```bash
   az keyvault set-policy \
     --name "cafe-dist-keyvault" \
     --object-id "<FUNCTION_APP_MANAGED_IDENTITY_OBJECT_ID>" \
     --secret-permissions get list
   ```

---

## DevSecOps Pipeline

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DevSecOps Pipeline                            │
│                                                                 │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │  Code   │──►│  Build   │──►│  Test    │──►│  Security    │ │
│  │  Push   │   │          │   │          │   │  Scan        │ │
│  └─────────┘   └──────────┘   └──────────┘   └──────┬───────┘ │
│                                                      │         │
│                                                      ▼         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Deploy                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   Staging    │──►│  Approval    │──►│  Production  │  │   │
│  │  │   (Auto)     │  │  (Manual)    │  │  (Auto)      │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### GitHub Actions Workflows

#### 1. CI Pipeline (`.github/workflows/ci.yml`)

Triggers on every push and pull request to `main`:

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ─── API (Python / Azure Functions) ──────────────────────
  api-lint-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: pip install flake8 pytest bandit safety
      - name: Lint (flake8)
        run: flake8 . --max-line-length=120
      - name: Security scan (bandit)
        run: bandit -r . -f json -o bandit-report.json || true
      - name: Dependency vulnerability check (safety)
        run: safety check --output json > safety-report.json || true
      - name: Unit tests (pytest)
        run: pytest tests/ -v --tb=short
      - name: Upload security reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: api-security-reports
          path: api/*-report.json

  # ─── Web (React / TypeScript) ────────────────────────────
  web-lint-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test -- --coverage --watchAll=false
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: web-coverage
          path: web/coverage/

  # ─── Mobile (React Native) ───────────────────────────────
  mobile-lint-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: mobile/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
```

#### 2. CD Pipeline (`.github/workflows/cd.yml`)

Triggers on merge to `main`:

```yaml
name: CD Pipeline

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      # ─── Build & Deploy API ────────────────────────────
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r api/requirements.txt
      - name: Deploy Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: cafe-dist-api-staging
          package: api/
          publish-profile: ${{ secrets.AZURE_FUNCTIONS_PUBLISH_PROFILE_STAGING }}

      # ─── Build & Deploy Web App ────────────────────────
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd web && npm ci && npm run build
      - name: Deploy Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_TOKEN_STAGING }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "web/dist"
          api_location: "api"

      # ─── Run Integration Tests ─────────────────────────
      - name: Run integration tests
        run: |
          cd api && pytest tests/integration/ -v --base-url=${{ secrets.STAGING_URL }}

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: cafe-dist-api
          package: api/
          publish-profile: ${{ secrets.AZURE_FUNCTIONS_PUBLISH_PROFILE }}
      - name: Deploy Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "web/dist"
          api_location: "api"
```

### GitHub Secrets Required for CI/CD

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret Name | Description |
|-------------|-------------|
| `AZURE_FUNCTIONS_PUBLISH_PROFILE` | Azure Functions publish profile (production) |
| `AZURE_FUNCTIONS_PUBLISH_PROFILE_STAGING` | Azure Functions publish profile (staging) |
| `AZURE_STATIC_WEB_APPS_TOKEN` | Static Web Apps deployment token (production) |
| `AZURE_STATIC_WEB_APPS_TOKEN_STAGING` | Static Web Apps deployment token (staging) |
| `STAGING_URL` | Staging environment URL for integration tests |

### Security Scanning in Pipeline

| Tool | Purpose | Runs On |
|------|---------|---------|
| **Flake8** | Python code quality | API PRs & pushes |
| **Bandit** | Python security vulnerability scanner | API PRs & pushes |
| **Safety** | Python dependency vulnerability check | API PRs & pushes |
| **ESLint** | TypeScript/React linting | Web & Mobile PRs |
| **TypeScript Compiler** | Type safety checks | Web & Mobile PRs |
| **Trivy** | Container/image vulnerability scanning (if containers used) | Deploy stage |
| **CodeQL** | SAST (Static Application Security Testing) | Weekly scheduled scan |

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

| Task | Details |
|------|---------|
| Azure resource setup | Resource groups, Key Vault, managed identities |
| Azure AD B2C configuration | Tenant, app registrations, user flows for admin/seller |
| Azure SQL Database | Provision Basic tier, run schema migrations |
| GitHub repo setup | Branch protection, secrets, CI/CD workflows |
| Project scaffolding | Azure Functions (Python), React (Vite), React Native |
| Authentication | Login/register/logout flows across web and mobile |

### Phase 2: Core Modules (Weeks 4-7)

| Task | Details |
|------|---------|
| Inventory management | CRUD operations, low-stock alerts |
| Sales tracking | Register sales, GPS coordinates, reports |
| Complaint management | Submit, track, resolve complaints |
| Admin dashboards | Sales overview, inventory health, complaint status |

### Phase 3: Routes & GPS (Weeks 8-10)

| Task | Details |
|------|---------|
| Route creation | Admin creates routes with waypoints |
| Route assignment | Assign routes to sellers |
| GPS tracking | Real-time location updates via Azure Maps |
| Check-in system | Seller check-in/check-out at waypoints |
| Route visualization | Map-based route display on admin dashboard |

### Phase 4: Polish & Deploy (Weeks 11-12)

| Task | Details |
|------|---------|
| Mobile app polish | UI refinement, offline handling |
| Integration testing | End-to-end tests against staging |
| Performance testing | Load testing API endpoints |
| Production deployment | Final deploy, monitoring, alerting setup |
| Documentation | User guides, admin manual |

---

## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Azure Functions Core Tools v4
- Azure CLI
- Git

### 1. Clone and Setup

```bash
git clone <REPO_URL>
cd SistenaDistribucion
```

### 2. API Setup

```bash
cd api
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Create `api/local.settings.json` (gitignored):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AZURE_SQL_CONNECTION_STRING": "Server=<server>.database.windows.net;Database=cafe-distribution;User Id=<user>;Password=<password>;Encrypt=True;",
    "AZURE_B2C_TENANT_NAME": "<YOUR_TENANT_NAME>",
    "AZURE_B2C_CLIENT_ID": "<YOUR_CLIENT_ID>",
    "AZURE_B2C_POLICY_NAME": "<YOUR_POLICY_NAME>",
    "AZURE_MAPS_KEY": "<YOUR_MAPS_KEY>"
  }
}
```

Run API locally:

```bash
func start
```

### 3. Web App Setup

```bash
cd web
npm install
npm run dev
```

Create `web/.env.local` (gitignored):

```
VITE_API_BASE_URL=http://localhost:7071/api
VITE_AZURE_B2C_TENANT_NAME=<YOUR_TENANT_NAME>
VITE_AZURE_B2C_CLIENT_ID=<YOUR_CLIENT_ID>
VITE_AZURE_B2C_POLICY_NAME=<YOUR_POLICY_NAME>
```

### 4. Mobile App Setup

```bash
cd mobile
npm install
npx react-native run-android  # or run-ios
```

Create `mobile/.env.local` (gitignored):

```
API_BASE_URL=http://<YOUR_LOCAL_IP>:7071/api
AZURE_B2C_TENANT_NAME=<YOUR_TENANT_NAME>
AZURE_B2C_CLIENT_ID=<YOUR_CLIENT_ID>
AZURE_B2C_POLICY_NAME=<YOUR_POLICY_NAME>
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Azure Functions won't start locally | Verify `local.settings.json` has correct Python version and connection strings |
| CORS errors | Add `http://localhost:5173` to Azure Functions CORS settings |
| Auth redirect fails | Verify redirect URI in Azure AD B2C matches your app URL + `/.auth/login/aadb2c/callback` |
| GPS location not updating | Check mobile device location permissions and network connectivity |
| SQL connection refused | Verify Azure SQL firewall rules allow your IP address |

### Azure CLI Quick Reference

```bash
# Login to Azure
az login

# List subscriptions
az account list -o table

# Set active subscription
az account set --subscription "<SUBSCRIPTION_NAME>"

# Create resource group
az group create --name "cafe-dist-rg" --location "eastus"

# Deploy infrastructure (when Bicep templates are ready)
az deployment group create \
  --resource-group "cafe-dist-rg  " \
  --template-file infrastructure/main.bicep \
  --parameters infrastructure/parameters.json
```

---

## License

Internal use only. All rights reserved.
