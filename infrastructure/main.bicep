@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name')
param environmentName string = 'production'

@description('PostgreSQL Admin password')
@secure()
param postgresAdminPassword string

@description('PostgreSQL Admin login')
param postgresAdminLogin string = 'cafeadmin'

@description('Azure Maps Key')
@secure()
param azureMapsKey string

@description('Auth secret key for token signing')
@secure()
param authSecretKey string

var postgresServerName = 'cafedist${environmentName}pg'
var postgresDatabaseName = 'cafe_distribution'
var keyVaultName = 'kv${uniqueString(resourceGroup().id)}'
var appServicePlanName = 'cafe-dist-${environmentName}-plan'
var webAppName = 'cafe-dist-${environmentName}-api'
var staticWebAppName = 'cafe-dist-${environmentName}-web'
var storageAccountName = 'cafedist${environmentName}stor'
var appInsightsName = 'cafe-dist-${environmentName}-insights'
var postgresSkuName = 'Standard_B1ms'
var postgresStorageGB = 32

// ─── Storage Account ───────────────────────────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// ─── Application Insights ──────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: null
  }
}

// ─── Key Vault ──────────────────────────────────────────────────
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enableRbacAuthorization: true
    enablePurgeProtection: true
    networkAcls: { defaultAction: 'Allow' }
  }
}

// ─── Azure Database for PostgreSQL ─────────────────────────────
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresServerName
  location: location
  sku: { name: postgresSkuName, tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: postgresStorageGB }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgresServer
  name: postgresDatabaseName
}

// ─── App Service Plan (Consumption - Linux) ─────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: { name: 'Y1', tier: 'Dynamic' }
  properties: {
    reserved: true
  }
}

// ─── Flask API (App Service) ───────────────────────────────────
resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appCommandLine: 'gunicorn --bind=0.0.0.0 --timeout 600 app:app'
      appSettings: [
        { name: 'DATABASE_URL', value: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require' }
        { name: 'AUTH_SECRET_KEY', value: '${keyVault.properties.vaultUri}secrets/AUTH-SECRET-KEY' }
        { name: 'AZURE_MAPS_KEY', value: azureMapsKey }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: appInsights.properties.InstrumentationKey }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'ENABLE_ORYX_BUILD_SYSTEM', value: 'true' }
      ]
      cors: {
        allowedOrigins: [
          'https://${staticWebAppName}.azurestaticapps.net'
          'http://localhost:5173'
        ]
      }
    }
  }
}

// ─── Static Web App ─────────────────────────────────────────────
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: staticWebAppName
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {}
}

// ─── Key Vault Secrets ──────────────────────────────────────────
resource keyVaultSecretDb 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'DATABASE-URL'
  properties: {
    value: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'
  }
}

resource keyVaultSecretMapsKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'AZURE-MAPS-KEY'
  properties: { value: azureMapsKey }
}

resource keyVaultSecretAuthKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'AUTH-SECRET-KEY'
  properties: { value: authSecretKey }
}

// ─── Outputs ────────────────────────────────────────────────────
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output webAppName string = webApp.name
output staticWebAppName string = staticWebApp.name
output keyVaultName string = keyVault.name
output storageAccountName string = storageAccount.name
output resourceGroupName string = resourceGroup().name
output appInsightsName string = appInsights.name
