@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Environment name (staging or production)')
param environmentName string = 'staging'

@description('SQL Admin password')
@secure()
param sqlAdminPassword string

@description('SQL Admin login')
param sqlAdminLogin string = 'cafeadmin'

@description('B2C Tenant Name')
param b2cTenantName string

@description('B2C Client ID')
param b2cClientId string

@description('B2C Client Secret')
@secure()
param b2cClientSecret string

@description('B2C Policy Name')
param b2cPolicyName string

@description('Azure Maps Key')
@secure()
param azureMapsKey string

// ─── Resource Names ─────────────────────────────────────────────
var sqlServerName = 'cafedist${environmentName}sql'
var sqlDatabaseName = 'cafe-distribution'
var keyVaultName = 'cafe-dist-${environmentName}-kv'
var functionAppName = 'cafe-dist-${environmentName}-api'
var staticWebAppName = 'cafe-dist-${environmentName}-web'

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

// Allow Azure services
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ─── App Service Plan (Consumption) ─────────────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: 'cafe-dist-${environmentName}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  reserved: true
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
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${keyVaultName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${listKeys(keyVault.id, '2023-02-01').keys[0].value}' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'AZURE_SQL_CONNECTION_STRING', value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${sqlDatabaseName};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;' }
        { name: 'AZURE_B2C_TENANT_NAME', value: b2cTenantName }
        { name: 'AZURE_B2C_CLIENT_ID', value: b2cClientId }
        { name: 'AZURE_B2C_CLIENT_SECRET', value: b2cClientSecret }
        { name: 'AZURE_B2C_POLICY_NAME', value: b2cPolicyName }
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

resource keyVaultSecretB2CClientId 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'AZURE-B2C-CLIENT-ID'
  properties: { value: b2cClientId }
}

resource keyVaultSecretB2CClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'AZURE-B2C-CLIENT-SECRET'
  properties: { value: b2cClientSecret }
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
output resourceGroupName string = resourceGroup().name
