import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { PublicClientApplication, AccountInfo } from '@azure/msal-browser'
import { msalConfig, loginRequest } from '../config/auth'

interface User {
  user_id: string
  email: string
  role: string
  name: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: () => Promise<void>
  logout: () => void
  getAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getRoleFromClaims(claims: Record<string, unknown>): string {
  // Microsoft Entra External ID custom claims
  const extensionRole = claims['extension_role'] || claims['extension_<appid>_role']
  if (extensionRole) {
    return String(extensionRole).toLowerCase()
  }
  // Check for roles claim (app roles)
  const roles = claims['roles'] || claims['role']
  if (Array.isArray(roles)) {
    return roles[0] || 'seller'
  }
  if (typeof roles === 'string') {
    return roles.toLowerCase()
  }
  return 'seller' // Default role
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [instance] = useState(() => new PublicClientApplication(msalConfig))
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await instance.handleRedirectPromise()
        if (response) {
          setAccounts(response.account ? [response.account] : [])
        } else {
          const currentAccounts = instance.getAllAccounts()
          setAccounts(currentAccounts)
        }
      } catch (error) {
        console.error('Failed to handle redirect:', error)
      }
      setLoading(false)
    }
    loadAccounts()
  }, [instance])

  useEffect(() => {
    const loadUser = async () => {
      if (accounts.length > 0) {
        const account = accounts[0]
        try {
          const response = await instance.acquireTokenSilent({
            scopes: loginRequest.scopes,
            account: accounts[0],
          })
          
          const idTokenClaims = response.idTokenClaims as Record<string, unknown>
          const role = getRoleFromClaims(idTokenClaims)
          
          setUser({
            user_id: account.localAccountId,
            email: account.username,
            role: role,
            name: account.name || '',
          })
        } catch (error) {
          console.error('Failed to get user claims:', error)
          setUser({
            user_id: account.localAccountId,
            email: account.username,
            role: 'seller',
            name: account.name || '',
          })
        }
      }
    }
    
    loadUser()
  }, [accounts, instance])

  const login = async () => {
    try {
      await instance.loginRedirect(loginRequest)
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  const logout = () => {
    instance.logoutRedirect()
  }

  const getAccessToken = async (): Promise<string | null> => {
    if (accounts.length === 0) return null
    try {
      const response = await instance.acquireTokenSilent({
        scopes: loginRequest.scopes,
        account: accounts[0],
      })
      return response.accessToken
    } catch {
      return null
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
