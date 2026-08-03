import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'

interface User {
  user_id: string
  email: string
  role: string
  name: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  getAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Login failed')
    }

    const { token, user: userData } = await res.json()
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    const storedUser = localStorage.getItem('auth_user')
    const role = storedUser ? JSON.parse(storedUser).role : null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setUser(null)
    window.location.href = role === 'admin' ? '/login/admin' : '/login/seller'
  }

  const getAccessToken = async (): Promise<string | null> => {
    return localStorage.getItem('auth_token')
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
