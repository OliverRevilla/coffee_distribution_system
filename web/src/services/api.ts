import axios from 'axios'
import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig, apiScopes } from '../config/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'

// MSAL instance for token acquisition
let msalInstance: PublicClientApplication | null = null

function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig)
  }
  return msalInstance
}

async function getAccessToken(): Promise<string | null> {
  try {
    const instance = getMsalInstance()
    const accounts = instance.getAllAccounts()
    if (accounts.length === 0) return null

    const response = await instance.acquireTokenSilent({
      scopes: apiScopes,
      account: accounts[0],
    })
    return response.accessToken
  } catch (error) {
    console.error('Failed to acquire token silently:', error)
    return null
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// API functions
export const inventoryApi = {
  list: () => api.get('/inventory'),
  get: (id: number) => api.get(`/inventory/${id}`),
  create: (data: any) => api.post('/inventory', data),
  update: (id: number, data: any) => api.put(`/inventory/${id}`, data),
}

export const variantsApi = {
  list: () => api.get('/variants'),
  create: (data: any) => api.post('/variants', data),
}

export const salesApi = {
  list: () => api.get('/sales'),
  create: (data: any) => api.post('/sales', data),
  get: (id: number) => api.get(`/sales/${id}`),
}

export const routesApi = {
  list: () => api.get('/routes'),
  create: (data: any) => api.post('/routes', data),
  assign: (id: number, data: any) => api.put(`/routes/${id}/assign`, data),
  checkin: (id: number, data: any) => api.post(`/routes/${id}/checkin`, data),
}

export const complaintsApi = {
  list: () => api.get('/complaints'),
  create: (data: any) => api.post('/complaints', data),
  update: (id: number, data: any) => api.put(`/complaints/${id}`, data),
  resolve: (id: number, data: any) => api.put(`/complaints/${id}/resolve`, data),
}

export const sellersApi = {
  list: () => api.get('/sellers'),
  create: (data: any) => api.post('/sellers', data),
  update: (id: number, data: any) => api.put(`/sellers/${id}`, data),
  updateStatus: (id: number, data: any) => api.put(`/sellers/${id}/status`, data),
}

export const trackingApi = {
  updateLocation: (data: any) => api.post('/tracking/location', data),
  getSellerLocations: (id: number) => api.get(`/tracking/seller/${id}`),
  getSellerLatest: (id: number) => api.get(`/tracking/seller/${id}/latest`),
}

export const reportsApi = {
  getSalesReport: () => api.get('/reports/sales'),
}
