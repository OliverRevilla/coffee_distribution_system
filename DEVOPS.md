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

**Important:** Use `westus2` — it supports all resource types (Static Web Apps, SQL, Functions).

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
    azureMapsKey="<YOUR_AZURE_MAPS_KEY>"
```

---

## Step 7: Get App Service Publish Profile

```bash
az webapp deployment list-publishing-profiles \
  --name "cafe-dist-production-api" \
  --resource-group "coffee-distribution-rg" \
  --xml
```

**Copy the entire XML output.**

---

## Step 8: Get Static Web App Token

1. Go to https://portal.azure.com
2. Search for **cafe-dist-production-web**
3. Click **Manage deployment tokens**
4. Copy the token

---

## Step 9: Configure GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | How to get it |
|-------------|---------------|
| `AZURE_CREDENTIALS` | Step 3 — entire JSON output |
| `AZURE_RESOURCE_GROUP` | `coffee-distribution-rg` |
| `POSTGRES_ADMIN_PASSWORD` | Step 4 — your password |
| `AZURE_MAPS_KEY` | Step 5 — primaryKey |
| `AZURE_PROD_PUBLISH_PROFILE` | Step 7 — entire XML |
| `AZURE_PROD_STATIC_WEB_APPS_TOKEN` | Step 8 — token |

---

## Step 10: Push to GitHub

```bash
git add .
git commit -m "Configure CI/CD pipeline"
git push origin main
```

---

## Troubleshooting

### "You cannot change the OS hosting your app"

Old App Service Plan exists as Windows. Delete it:

```bash
az appservice plan delete --name "cafe-dist-production-plan" --resource-group "coffee-distribution-rg" --yes
```

### "VaultNameNotValid"

Key Vault name must be 3-24 alphanumeric chars, no consecutive hyphens. Already fixed in template.

### "LocationNotAvailableForResourceType"

Static Web Apps doesn't support `eastus`. Use `westus2` or `eastus2`.

### "No VM quota"

Try a different region:

```bash
az account list-locations --output table
```

### App Service Plan Limitations

- No VNET integration (not needed for this project)
- Basic tier: 1.75 GB RAM, 10 GB storage
- Max 10 minute request timeout

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
| App Service (Basic B1) | ~$13 |
| Static Web App (Standard) | ~$9 |
| Azure Maps (Gen2) | Pay per use (free tier available) |
| Storage Account | ~$1 |
| Key Vault | ~$0.03/10K operations |
| Application Insights | ~$0 (free tier) |
| **Total** | **~$35-36/month** |
