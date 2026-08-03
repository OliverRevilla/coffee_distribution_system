import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { routesApi, salesApi } from '../../services/api'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

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

  const totalRevenue = useMemo(
    () => sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
    [sales]
  )

  const salesByDate = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>()
    sales.forEach((s) => {
      const date = new Date(s.sale_date).toLocaleDateString()
      const existing = map.get(date) || { revenue: 0, count: 0 }
      map.set(date, {
        revenue: existing.revenue + Number(s.total_amount || 0),
        count: existing.count + 1,
      })
    })
    return Array.from(map.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [sales])

  const salesByVariant = useMemo(() => {
    const map = new Map<string, { revenue: number; quantity: number }>()
    sales.forEach((s) => {
      const name = s.variant_name || 'Unknown'
      const existing = map.get(name) || { revenue: 0, quantity: 0 }
      map.set(name, {
        revenue: existing.revenue + Number(s.total_amount || 0),
        quantity: existing.quantity + (s.quantity || 0),
      })
    })
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }))
  }, [sales])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome, {user?.name}
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Pending Routes</div>
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
            ${totalRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Trend */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Trend</h2>
          {salesByDate.length === 0 ? (
            <p className="text-gray-500">No sales data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesByDate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue ($)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sales by Product */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales by Product</h2>
          {salesByVariant.length === 0 ? (
            <p className="text-gray-500">No sales data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesByVariant}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue ($)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Sales</h2>
        {sales.length === 0 ? (
          <p className="text-gray-500">No sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.slice(0, 10).map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.variant_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.customer_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${Number(sale.total_amount || 0).toFixed(2)}
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
