import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { routesApi, salesApi } from '../../services/api'

export default function DashboardPage() {
  const { user } = useAuth()
  const [routes, setRoutes] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [routesRes, salesRes] = await Promise.all([
          routesApi.list(),
          salesApi.list(),
        ])
        setRoutes(routesRes.data.routes || [])
        setSales(salesRes.data.sales || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome, {user?.name}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Today's Routes</div>
          <div className="mt-2 text-3xl font-bold text-amber-600">
            {routes.filter(r => r.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Sales</div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            {sales.length}
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Revenue</div>
          <div className="mt-2 text-3xl font-bold text-blue-600">
            ${sales.reduce((sum, s) => sum + (s.total_amount || 0), 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Sales</h2>
        {sales.length === 0 ? (
          <p className="text-gray-500">No sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.slice(0, 5).map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.variant_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${sale.total_amount?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
