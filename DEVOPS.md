# Coffee Distribution System - DevOps Guide

## Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Azure Cloud                           │
├─────────────────────────────────────────────────────────┤
│  Resource Group: coffee-distribution-rg (westus2)       │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ PostgreSQL  │  │  App Service│  │ Static Web  │    │
│  │ (Flexible)  │  │   (Flask)   │  │    App      │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │Key Vault    │  │   Storage   │  │ Azure Maps  │    │
│  │ (secrets)   │  │  Account    │  │  (Gen2)     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│  ┌─────────────┐                                       │
│  │App Insights │                                       │
│  │(monitoring) │                                       │
│  └─────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) installed
- [GitHub account](https://github.com)
- Azure subscription with Contributor access

---

## Step 1: Azure Login

```bash
az login
```

---

## Step 2: Create Resource Group

```bash
az group create \
  --name "coffee-distribution-rg" \
  --location "westus2"
```

---

## Step 3: Create Service Principal with OIDC (for GitHub Actions)

```bash
# Create the app registration
APP_REG=$(az ad app create \
  --display-name "coffee-dist-cicd" \
  --sign-in-audience "AzureADMyOrg" \
  --query "{id:appId, objectId:id}" -o json)

APP_ID=$(echo $APP_REG | jq -r '.id')
APP_OBJECT_ID=$(echo $APP_REG | jq -r '.objectId')

# Create service principal
az ad sp create --id $APP_ID

# Assign Contributor role
az role assignment create \
  --assignee $APP_ID \
  --role "Contributor" \
  --scope "/subscriptions/$(az account show --query id -o tsv)"

# Create federated credential for GitHub (main branch)
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/applications/$APP_OBJECT_ID/federatedIdentityCredentials" \
  --body '{
    "name": "github-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:OliverRevilla/coffee_distribution_system:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
```

**Copy the three values above — you'll need them for GitHub secrets.**

---

## Step 4: Create PostgreSQL Admin Password

```bash
openssl rand -base64 16
```

**Save this password.**

---

## Step 5: Create Azure Maps Account (Gen2)

```bash
az maps account create \
  --name "cafedistmaps" \
  --resource-group "coffee-distribution-rg" \
  --sku "G2"

az maps account keys list \
  --name "cafedistmaps" \
  --resource-group "coffee-distribution-rg" \
  --query "primaryKey" -o tsv
```

**Copy the key.**

---

## Step 6: Generate Auth Secret Key

```bash
openssl rand -hex 32
```

**Save this key.**

---

## Step 7: Deploy Infrastructure via GitHub Actions

1. Push your code to GitHub
2. Go to **Actions → CD Pipeline → Run workflow**
3. Check **deploy_infrastructure** and optionally **seed_data**
4. Click **Run workflow**

The workflow will deploy all Azure resources via Bicep, apply the schema, and optionally seed test data.

---

## Step 8: Configure GitHub Secrets and Variables

After the infrastructure is deployed, configure the secrets and variables.

### Secrets (sensitive — never logged)

Go to **GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | How to get it |
|-------------|---------------|
| `AZURE_CLIENT_ID` | From Step 3 — the `appId` output |
| `AZURE_TENANT_ID` | From Step 3 — `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | From Step 3 — `az account show --query id -o tsv` |
| `POSTGRES_ADMIN_PASSWORD` | From Step 4 — the password you generated |
| `AZURE_MAPS_KEY` | From Step 5 — Azure Maps primary key |
| `AUTH_SECRET_KEY` | From Step 6 — the hex key you generated |
| `AZURE_PROD_PUBLISH_PROFILE` | `az webapp deployment list-publishing-profiles --name "cafe-dist-production-api" --resource-group "coffee-distribution-rg" --xml` |
| `AZURE_PROD_STATIC_WEB_APPS_TOKEN` | Azure Portal → Static Web App → Manage deployment tokens |
| `AZURE_DATABASE_URL` | `az webapp config appsettings list --name cafe-dist-production-api --resource-group coffee-distribution-rg --query "[?name=='DATABASE_URL'].value" -o tsv` |

### Variables (non-sensitive — visible in logs)

Go to **GitHub → Settings → Secrets and variables → Actions → Variables → New repository variable**

| Variable Name | How to get it |
|---------------|---------------|
| `VITE_API_BASE_URL` | `echo "https://$(az webapp show --name 'cafe-dist-production-api' --resource-group 'coffee-distribution-rg' --query 'defaultHostName' -o tsv)/api"` |
| `VITE_ENTRA_TENANT_NAME` | Your Entra External ID tenant name (e.g. `cafedistribution`) |
| `VITE_ENTRA_CLIENT_ID` | From `infrastructure/setup-entra.sh` output — Web App registration `appId` |
| `VITE_ENTRA_POLICY_NAME` | From `infrastructure/setup-entra.sh` output — e.g. `B2C_1_susi` |

---

## Step 9: Push to GitHub

```bash
git add .
git commit -m "Configure CI/CD pipeline"
git push origin main
```

The CD pipeline will automatically deploy on push to `main`.

---

## CI/CD Workflow

### CI Pipeline (runs on every push and PR)

| Job | What it does |
|-----|-------------|
| `infrastructure-validate` | Validates Bicep template |
| `api-lint-and-test` | Python lint (flake8), security scan (bandit), tests (pytest) |
| `web-lint-and-test` | TypeScript type check, ESLint, vitest |
| `mobile-lint-and-test` | TypeScript type check, ESLint |

### CD Pipeline (runs on push to `main`)

Two modes:

#### Default mode (code updates)

| Step | What it does |
|------|-------------|
| Apply schema | Runs `schema.sql` (idempotent — safe every deploy) |
| Deploy API | Deploys Flask app to Azure App Service |
| Build & Deploy Web | Builds React with env vars from GitHub variables, deploys to Static Web Apps |
| Health Check | Verifies API is responding after 30s (handles Consumption plan cold start) |

#### Infrastructure mode (manual trigger — `deploy_infrastructure: true`)

| Step | What it does |
|------|-------------|
| Deploy Bicep | Creates/updates all Azure resources |
| Apply schema | Runs `schema.sql` |
| Seed users | Creates admin and test seller accounts |
| Seed data | (optional) Creates test data with Lima locations |
| Deploy API | Deploys Flask app |
| Build & Deploy Web | Builds & deploys React app |
| Health Check | Verifies API health |

### Secrets Flow

```
OIDC Login:
  AZURE_CLIENT_ID       →  az login (federated credential)
  AZURE_TENANT_ID       →  az login
  AZURE_SUBSCRIPTION_ID →  az login

Infrastructure:
  POSTGRES_ADMIN_PASSWORD  →  Bicep param (PostgreSQL admin)
  AZURE_MAPS_KEY           →  Bicep param (Azure Maps)
  AUTH_SECRET_KEY          →  Bicep param (token signing)

Code deployment:
  AZURE_PROD_PUBLISH_PROFILE        →  Deploy Flask to App Service
  AZURE_DATABASE_URL                →  Run schema.sql
  AZURE_PROD_STATIC_WEB_APPS_TOKEN  →  Deploy React to Static Web Apps

Frontend build (injected as env vars):
  VITE_API_BASE_URL        →  Baked into React build
  VITE_ENTRA_TENANT_NAME   →  Baked into React build
  VITE_ENTRA_CLIENT_ID     →  Baked into React build
  VITE_ENTRA_POLICY_NAME   →  Baked into React build
```

---

## Troubleshooting

### "You cannot change the OS hosting your app"

Old App Service Plan exists as Windows. Delete it:

```bash
az appservice plan delete --name "cafe-dist-production-plan" --resource-group "coffee-distribution-rg" --yes
```

### "LocationNotAvailableForResourceType"

Static Web Apps doesn't support `eastus`. Use `westus2` or `eastus2`.

### "No VM quota"

Try a different region:

```bash
az account list-locations --output table
```

### API Connection Refused (Production)

The API runs on Azure **Consumption plan (Y1)**, which auto-stops after ~20 minutes of inactivity. The first request after idle takes **30-60 seconds** for cold start. The CD pipeline waits 30 seconds before health check — if it fails, the API is likely still starting.

### Frontend Shows Localhost Errors

If the production frontend shows `http://localhost:7071` errors, the build was done without `VITE_API_BASE_URL`. The CD pipeline sets this automatically via GitHub variables, but manual builds must include it:

```bash
cd web
VITE_API_BASE_URL=https://cafe-dist-production-api.azurewebsites.net/api npm run build
```

### OIDC Login Fails

- Verify the federated credential was created: `az ad app credential list --id <APP_ID>`
- Ensure the `subject` matches your repo exactly: `repo:OliverRevilla/coffee_distribution_system:ref:refs/heads/main`
- Check the app has the `Contributor` role: `az role assignment list --assignee <APP_ID>`

---

## Useful Commands

```bash
# List all resources
az resource list --resource-group "coffee-distribution-rg" --output table

# Get App Service URL
az webapp show --name "cafe-dist-production-api" --resource-group "coffee-distribution-rg" --query "defaultHostName" -o tsv

# Get Static Web App URL
az staticwebapp show --name "cafe-dist-production-web" --resource-group "coffee-distribution-rg" --query "defaultHostname" -o tsv

# Stream App Service logs
az webapp log tail --name "cafe-dist-production-api" --resource-group "coffee-distribution-rg"

# Run schema manually
psql "$DATABASE_URL" -f infrastructure/schema.sql

# Delete everything and start over
az group delete --name "coffee-distribution-rg" --yes --no-wait
```

---

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| PostgreSQL (Burstable B1ms) | ~$12 |
| App Service (Consumption Y1) | ~$0-5 |
| Static Web App (Standard) | ~$9 |
| Azure Maps (Gen2) | Pay per use (free tier available) |
| Storage Account | ~$1 |
| Key Vault | ~$0.03/10K operations |
| Application Insights | ~$0 (free tier) |
| **Total** | **~$22-27/month** |

### Cost Optimization: PostgreSQL Auto-Pause

When not actively using the database, enable auto-pause to reduce PostgreSQL cost from ~$12 to ~$1.50/month (storage only):

```bash
# Enable auto-pause (server stops after idle period)
az postgres flexible-server update \
  --resource-group "coffee-distribution-rg" \
  --name "cafedistproductionpg" \
  --standby-mode Enabled

# Resume when needed (takes ~30-60 seconds)
az postgres flexible-server start \
  --resource-group "coffee-distribution-rg" \
  --name "cafedistproductionpg"
```

### Stop/Start App Service (Consumption Plan)

The Consumption plan charges only when the app handles requests. It auto-stops after ~20 minutes of inactivity. To manually control:

```bash
# Stop App Service (no charges while stopped)
az webapp stop --name "cafe-dist-production-api" --resource-group "coffee-distribution-rg"

# Start App Service
az webapp start --name "cafe-dist-production-api" --resource-group "coffee-distribution-rg"
```
