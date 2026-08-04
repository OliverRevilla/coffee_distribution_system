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

## Step 3: Create Service Principal (for GitHub Actions)

```bash
az ad sp create-for-rbac \
  --name "coffee-dist-cicd" \
  --sdk-auth \
  --role Contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)
```

**Copy the entire JSON output.**

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

## Step 6: Deploy Infrastructure with Bicep

```bash
az deployment group create \
  --resource-group "coffee-distribution-rg" \
  --template-file infrastructure/main.bicep \
  --parameters \
    environmentName=production \
    postgresAdminPassword="<YOUR_POSTGRES_PASSWORD>" \
    azureMapsKey="<YOUR_AZURE_MAPS_KEY>" \
    authSecretKey="$(openssl rand -hex 32)"
```

---

## Step 7: Apply Database Schema

```bash
export DATABASE_URL="postgresql://cafeadmin:<YOUR_PASSWORD>@cafedistproductionpg.postgres.database.azure.com:5432/cafe_distribution?sslmode=require"
psql $DATABASE_URL -f infrastructure/schema.sql
python seed_users.py
```

---

## Step 8: Get App Service Publish Profile

```bash
az webapp deployment list-publishing-profiles \
  --name "cafe-dist-production-api" \
  --resource-group "coffee-distribution-rg" \
  --xml
```

**Copy the entire XML output.**

---

## Step 9: Get Static Web App Token

1. Go to https://portal.azure.com
2. Search for **cafe-dist-production-web**
3. Click **Manage deployment tokens**
4. Copy the token

---

## Step 10: Configure GitHub Secrets

Go to **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**

### Required Secrets

| Secret Name | Value | Where to get it |
|-------------|-------|-----------------|
| `AZURE_PROD_PUBLISH_PROFILE` | XML publish profile | Step 8 — `az webapp deployment list-publishing-profiles --xml` |
| `AZURE_PROD_STATIC_WEB_APPS_TOKEN` | Deployment token | Step 9 — Azure Portal → Static Web App → Manage deployment tokens |

### How to create a secret

1. Click **New repository secret**
2. Enter the **Name** exactly as shown above
3. Paste the **Value**
4. Click **Add secret**

---

## Step 11: Push to GitHub

```bash
git add .
git commit -m "Configure CI/CD pipeline"
git push origin main
```

The CD pipeline will automatically deploy to Azure.

---

## CI/CD Workflow

### CI Pipeline (runs on every push)

| Job | What it does |
|-----|-------------|
| `infrastructure-validate` | Validates Bicep template |
| `api-lint-and-test` | Python lint (flake8), security scan (bandit), tests (pytest) |
| `web-lint-and-test` | TypeScript type check, ESLint, vitest |
| `mobile-lint-and-test` | TypeScript type check, ESLint |

### CD Pipeline (runs on push to `main`)

| Step | What it does |
|------|-------------|
| Deploy API | Deploys Flask app to Azure App Service |
| Deploy Web | Builds and deploys React app to Static Web Apps |
| Health Check | Verifies API is responding |

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
