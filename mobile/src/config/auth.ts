import { Configuration } from '@azure/msal-browser'

const tenantName = process.env.ENTRA_TENANT_NAME || '<YOUR_TENANT_NAME>'
const clientId = process.env.ENTRA_CLIENT_ID || '<YOUR_CLIENT_ID>'

// Microsoft Entra External ID authority
const authority = `https://${tenantName}.ciamlogin.com/${tenantName}.onmicrosoft.com`

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: authority,
    redirectUri: 'msauth://cafedistributionmsal/',
  },
}

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
}

export const apiScopes = [`api://${clientId}/access_as_user`]
