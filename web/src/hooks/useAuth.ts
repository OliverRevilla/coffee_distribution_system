import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../config/auth'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (accounts.length > 0) {
      const account = accounts[0]
      // In a real app, you'd get role from B2C custom claims
      setUser({
        user_id: account.localAccountId,
        email: account.username,
        role: 'seller', // Default role, should come from B2C claims
        name: account.name || '',
      })
    }
    setLoading(false)
  }, [accounts])

  const login = async () => {
    try {
      await instance.loginRedirect(loginRequest)
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  const logout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: '/' })
  }

  const getAccessToken = async (): Promise<string | null> => {
    if (accounts.length === 0) return null
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      })
      return response.accessToken
    } catch {
      try {
        const response = await instance.acquireTokenRedirect(loginRequest)
        return response.accessToken
      } catch {
        return null
      }
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
