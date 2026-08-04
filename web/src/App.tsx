import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import SellerLoginPage from './pages/SellerLoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import SellerRegisterPage from './pages/SellerRegisterPage'
import DashboardPage from './pages/seller/DashboardPage'
import CustomersPage from './pages/seller/CustomersPage'
import SellerSalesPage from './pages/seller/SalesPage'
import TrackingPage from './pages/seller/TrackingPage'
import SellerProductsPage from './pages/seller/ProductsPage'
import ProfilePage from './pages/seller/ProfilePage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import InventoryPage from './pages/admin/InventoryPage'
import SalesPage from './pages/admin/SalesPage'
import RoutesPage from './pages/admin/RoutesPage'
import ComplaintsPage from './pages/admin/ComplaintsPage'
import SellersPage from './pages/admin/SellersPage'
import AdminProductsPage from './pages/admin/ProductsPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/seller" element={<SellerLoginPage />} />
          <Route path="/login/admin" element={<AdminLoginPage />} />
          <Route path="/register/seller" element={<SellerRegisterPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="tracking" element={<TrackingPage />} />
            <Route path="products" element={<SellerProductsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="sales" element={<SellerSalesPage />} />
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/products" element={<AdminProductsPage />} />
            <Route path="admin/inventory" element={<InventoryPage />} />
            <Route path="admin/sales" element={<SalesPage />} />
            <Route path="admin/routes" element={<RoutesPage />} />
            <Route path="admin/complaints" element={<ComplaintsPage />} />
            <Route path="admin/sellers" element={<SellersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
