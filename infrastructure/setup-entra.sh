#!/bin/bash
# =============================================================================
# Microsoft Entra External ID Setup Script for Coffee Distribution System
# =============================================================================
# This script creates:
#   1. App registrations (Web, API, Mobile) in External ID tenant
#   2. User flows with custom claims (role)
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Microsoft Entra External ID tenant already created
#
# IMPORTANT: Create the External ID tenant first:
#   1. Go to https://entra.microsoft.com
#   2. Click "+ Create a tenant"
#   3. Select "Create a tenant for managing external identities"
#   4. Enter tenant name (e.g., cafe-distribution)
#   5. Select region and create
#
# Usage:
#   chmod +x setup-entra.sh
#   ./setup-entra.sh
# =============================================================================

set -e

# Configuration
TENANT_NAME="${TENANT_NAME:-cafe-distribution}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@yourdomain.com}"

# Derived values
TENANT_DOMAIN="${TENANT_NAME}.onmicrosoft.com"
AUTHORITY="https://${TENANT_NAME}.ciamlogin.com/${TENANT_DOMAIN}"

echo "=========================================="
echo " Microsoft Entra External ID Setup"
echo "=========================================="
echo "Tenant: $TENANT_NAME"
echo "Domain: $TENANT_DOMAIN"
echo "Authority: $AUTHORITY"
echo "=========================================="
echo ""

# Step 1: Get tenant ID
echo "[1/6] Getting External ID tenant ID..."
TENANT_ID=$(az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/organization" \
  --query "value[0].id" \
  --output tsv 2>/dev/null || echo "")

if [ -z "$TENANT_ID" ]; then
  echo "❌ Could not retrieve tenant ID."
  echo ""
  echo "Please create the External ID tenant first:"
  echo "1. Go to https://entra.microsoft.com"
  echo "2. Click '+ Create a tenant'"
  echo "3. Select 'Create a tenant for managing external identities'"
  echo "4. Enter tenant name: $TENANT_NAME"
  echo "5. Wait for creation to complete"
  echo "6. Run this script again"
  exit 1
fi
echo "✓ Tenant ID: $TENANT_ID"
echo ""

# Step 2: Create custom attribute schema for role
echo "[2/6] Creating custom attribute schema (extension_role)..."
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/$TENANT_ID/schemaExtensions" \
  --body "{
    \"targetTypes\": [\"User\"],
    \"properties\": [{
      \"name\": \"role\",
      \"type\": \"String\"
    }],
    \"description\": \"User role (admin or seller)\"
  }" \
  --output json 2>/dev/null || echo "  (Attribute may already exist)"
echo "✓ Custom attribute created"
echo ""

# Step 3: Create Web App Registration
echo "[3/6] Creating Web App registration..."
WEB_APP_ID=$(az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/applications" \
  --body "{
    \"displayName\": \"Coffee Distribution - Web App\",
    \"signInAudience\": \"AzureADandPersonalMicrosoftAccount\",
    \"web\": {
      \"redirectUris\": [
        \"http://localhost:5173\",
        \"https://cafe-dist-production-web.azurestaticapps.net\"
      ],
      \"implicitGrantSettings\": {
        \"enableIdTokenIssuance\": true,
        \"enableAccessTokenIssuance\": false
      }
    }
  }" \
  --query "appId" \
  --output tsv)
echo "✓ Web App created: $WEB_APP_ID"
echo ""

# Step 4: Create API App Registration
echo "[4/6] Creating API App registration..."
API_APP_ID=$(az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/applications" \
  --body "{
    \"displayName\": \"Coffee Distribution - API\",
    \"signInAudience\": \"AzureADandPersonalMicrosoftAccount\",
    \"api\": {
      \"requestedAccessTokenVersion\": 2,
      \"oauth2PermissionScopes\": [{
        \"id\": \"$(uuidgen)\",
        \"value\": \"access_as_user\",
        \"adminConsentDescription\": \"Allow the app to access the API on behalf of the signed-in user\",
        \"adminConsentDisplayName\": \"Access API\",
        \"isEnabled\": true,
        \"type\": \"User\"
      }]
    }
  }" \
  --query "appId" \
  --output tsv)

# Create service principal for API
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals" \
  --body "{
    \"appId\": \"$API_APP_ID\"
  }" \
  --output json 2>/dev/null || true

echo "✓ API App created: $API_APP_ID"
echo ""

# Step 5: Create Mobile App Registration
echo "[5/6] Creating Mobile App registration..."
MOBILE_APP_ID=$(az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/applications" \
  --body "{
    \"displayName\": \"Coffee Distribution - Mobile App\",
    \"signInAudience\": \"AzureADandPersonalMicrosoftAccount\",
    \"publicClient\": {
      \"redirectUris\": [
        \"msauth://cafedistributionmsal/\",
        \"com.cafe-distribution://auth\"
      ]
    }
  }" \
  --query "appId" \
  --output tsv)
echo "✓ Mobile App created: $MOBILE_APP_ID"
echo ""

# Step 6: Create User Flow (Sign-up/Sign-in)
echo "[6/6] Creating Sign-up/Sign-in user flow..."
POLICY_NAME="B2C_1_susi"

# Create the user flow
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/identity/b2cUserFlows" \
  --body "{
    \"id\": \"$POLICY_NAME\",
    \"displayName\": \"Sign up and Sign in\",
    \"identityProviders\": [\"local\"],
    \"userFlowType\": \"signUpOrSignIn\",
    \"userFlowAttributesEnabled\": [\"emailSignUp\", \"signIn\"]
  }" \
  --output json 2>/dev/null || echo "  (User flow may already exist)"

echo "✓ User flow created: $POLICY_NAME"
echo ""

# Output Configuration
echo "=========================================="
echo " SETUP COMPLETE"
echo "=========================================="
echo ""
echo "Configuration values for your .env files:"
echo ""
echo "--- Web App (.env.local) ---"
echo "VITE_ENTRA_TENANT_NAME=$TENANT_NAME"
echo "VITE_ENTRA_CLIENT_ID=$WEB_APP_ID"
echo "VITE_ENTRA_POLICY_NAME=$POLICY_NAME"
echo ""
echo "--- API (local.settings.json) ---"
echo "ENTRA_TENANT_NAME=$TENANT_NAME"
echo "ENTRA_CLIENT_ID=$API_APP_ID"
echo "ENTRA_POLICY_NAME=$POLICY_NAME"
echo ""
echo "--- Mobile App (.env.local) ---"
echo "ENTRA_TENANT_NAME=$TENANT_NAME"
echo "ENTRA_CLIENT_ID=$MOBILE_APP_ID"
echo "ENTRA_POLICY_NAME=$POLICY_NAME"
echo ""
echo "--- GitHub Secrets ---"
echo "ENTRA_TENANT_NAME=$TENANT_NAME"
echo "ENTRA_WEB_CLIENT_ID=$WEB_APP_ID"
echo "ENTRA_API_CLIENT_ID=$API_APP_ID"
echo "ENTRA_MOBILE_CLIENT_ID=$MOBILE_APP_ID"
echo "ENTRA_POLICY_NAME=$POLICY_NAME"
echo ""
echo "=========================================="
echo " IMPORTANT: Create admin user"
echo "=========================================="
echo ""
echo "1. Go to https://entra.microsoft.com"
echo "2. Select your External ID tenant: $TENANT_NAME"
echo "3. Go to Users > New user"
echo "4. Create user with:"
echo "   - Email: $ADMIN_EMAIL"
echo "   - Display Name: Admin User"
echo "   - Password: (set a strong password)"
echo "5. After creation, go to User > Extensions"
echo "6. Set 'role' attribute to 'admin'"
echo ""
echo "=========================================="
echo " Next Steps"
echo "=========================================="
echo ""
echo "1. Install Node.js 20+ if not installed:"
echo "   https://nodejs.org/"
echo ""
echo "2. Update .env files with the values above"
echo ""
echo "3. Start the web app:"
echo "   cd web && npm install && npm run dev"
echo ""
echo "4. Test login at http://localhost:5173/login"
echo ""
