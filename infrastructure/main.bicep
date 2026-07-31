@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name (staging or production)')
param environmentName string = 'staging'

@description('SQL Admin password')
@secure()
param sqlAdminPassword string

@description('SQL Admin login')
param sqlAdminLogin string = 'cafeadmin'

@description('Azure Maps Key')
@secure()
param azureMapsKey string
var sqlServerName = 'cafedist${environmentName}sql'
var sqlDatabaseName = 'cafe-distribution'
var keyVaultName = 'kv${uniqueString(resourceGroup().id)}'
var functionAppName = 'cafe-dist-${environmentName}-api'
var staticWebAppName = 'cafe-dist-${environmentName}-web'
var storageAccountName = 'cafedist${environmentName}stor'
var appServicePlanName = 'cafe-dist-${environmentName}-plan'

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

// ─── SQL Server ─────────────────────────────────────────────────
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: { name: 'Basic', tier: 'Basic', capacity: 5 }
}

resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
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

// ─── Function App ───────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'WEBSITE_CONTENTAZUREFILESHARE', value: '' }
        { name: 'WEBSITE_CONTENTOVERWRITE', value: 'true' }
        { name: 'WEBSITE_SKIP_CONTENTSHARE_VALIDATION', value: '1' }
        { name: 'AZURE_SQL_CONNECTION_STRING', value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDatabaseName};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;' }
        { name: 'AZURE_MAPS_KEY', value: azureMapsKey }
      ]
      cors: {
        allowedOrigins: ['*']
      }
    }
    httpsOnly: true
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
resource keyVaultSecretSql 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'AZURE-SQL-CONNECTION-STRING'
  properties: {
    value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDatabaseName};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
  }
}

resource keyVaultSecretMapsKey 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'AZURE-MAPS-KEY'
  properties: { value: azureMapsKey }
}

// ─── Outputs ────────────────────────────────────────────────────
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output functionAppName string = functionApp.name
output staticWebAppName string = staticWebApp.name
output keyVaultName string = keyVault.name
output storageAccountName string = storageAccount.name
output resourceGroupName string = resourceGroup().name
