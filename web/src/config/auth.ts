import { Configuration, LogLevel } from '@azure/msal-browser'

const tenantName = import.meta.env.VITE_AZURE_B2C_TENANT_NAME || '<YOUR_TENANT_NAME>'
const clientId = import.meta.env.VITE_AZURE_B2C_CLIENT_ID || '<YOUR_CLIENT_ID>'
const policyName = import.meta.env.VITE_AZURE_B2C_POLICY_NAME || '<YOUR_POLICY_NAME>'

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/${policyName}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return
        switch (level) {
          case LogLevel.Error:
            console.error(message)
            break
          case LogLevel.Warning:
            console.warn(message)
            break
          default:
            break
        }
      },
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
}

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
}

export const apiScopes = [`api://${clientId}/access_as_user`]
