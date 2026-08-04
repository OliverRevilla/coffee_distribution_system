import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const storedUser = localStorage.getItem('auth_user')
      const role = storedUser ? JSON.parse(storedUser).role : null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.href = role === 'admin' ? '/login/admin' : '/login/seller'
    }
    return Promise.reject(error)
  }
)

export default api

export const customersApi = {
  list: () => api.get('/customers'),
  get: (id: number) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: number, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
}

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
  update: (id: number, data: any) => api.put(`/sales/${id}`, data),
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

export const authApi = {
  register: (data: { email: string; password: string; full_name: string; role: string }) =>
    api.post('/auth/register', data),
}
