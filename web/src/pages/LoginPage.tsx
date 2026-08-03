import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }
    }
  }, [user, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-600">☕ Cafe Distribution</h1>
          <p className="mt-2 text-gray-600">Choose your login</p>
        </div>
        <div className="space-y-4">
          <Link
            to="/login/seller"
            className="block w-full py-3 px-4 border border-transparent text-sm font-medium rounded-md text-center text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            Sign in as Seller
          </Link>
          <Link
            to="/login/admin"
            className="block w-full py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-center text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            Sign in as Admin
          </Link>
        </div>
        <p className="text-xs text-gray-500 text-center mt-4">
          New here?{' '}
          <Link to="/register/seller" className="text-amber-600 hover:text-amber-700">
            Register as Seller
          </Link>
        </p>
      </div>
    </div>
  )
}
