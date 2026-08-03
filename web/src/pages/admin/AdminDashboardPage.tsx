import { useEffect, useState } from 'react'
import { reportsApi, sellersApi, salesApi } from '../../services/api'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import SalesZonesMap from '../../components/SalesZonesMap'

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4']

export default function AdminDashboardPage() {
  const [report, setReport] = useState<any>(null)
  const [sellers, setSellers] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportRes, sellersRes, salesRes] = await Promise.all([
          reportsApi.getSalesReport(),
          sellersApi.list(),
          salesApi.list(),
        ])
        setReport(reportRes.data)
        setSellers(sellersRes.data.sellers || [])
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

  const salesByDate = (report?.by_date || []).map((d: any) => ({
    date: d.date,
    revenue: Number(d.total_revenue || 0),
    sales: d.total_sales,
  })).reverse()

  const salesByVariant = (report?.by_variant || []).map((v: any) => ({
    name: v.variant,
    value: Number(v.total_revenue || 0),
    quantity: v.total_quantity,
  }))

  const salesBySeller = (report?.by_seller || []).map((s: any) => ({
    name: s.seller,
    revenue: Number(s.total_revenue || 0),
    sales: s.total_sales,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Sales</div>
          <div className="mt-2 text-3xl font-bold text-amber-600">
            {report?.summary?.total_sales || 0}
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Revenue</div>
          <div className="mt-2 text-3xl font-bold text-green-600">
            ${Number(report?.summary?.total_revenue || 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Active Sellers</div>
          <div className="mt-2 text-3xl font-bold text-blue-600">
            {sellers.filter(s => s.status === 'active').length}
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Sellers</div>
          <div className="mt-2 text-3xl font-bold text-purple-600">
            {sellers.length}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Trend Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Trend (Last 30 Days)</h2>
          {salesByDate.length === 0 ? (
            <p className="text-gray-500">No sales data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesByDate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} name="Revenue ($)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sales by Variant Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue by Product</h2>
          {salesByVariant.length === 0 ? (
            <p className="text-gray-500">No sales data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesByVariant}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                <Legend />
                <Bar dataKey="value" name="Revenue ($)" radius={[4, 4, 0, 0]}>
                  {salesByVariant.map((_: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue by Seller Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Revenue by Seller</h2>
          {salesBySeller.length === 0 ? (
            <p className="text-gray-500">No sales data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={salesBySeller}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  dataKey="revenue"
                >
                  {salesBySeller.map((_: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sales Count by Seller */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Count by Seller</h2>
          {salesBySeller.length === 0 ? (
            <p className="text-gray-500">No sales data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesBySeller} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" name="Sales Count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Seller Table */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales by Seller</h2>
          {report?.by_seller?.length === 0 ? (
            <p className="text-gray-500">No sales data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {report?.by_seller?.map((seller: any) => (
                    <tr key={seller.seller}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{seller.seller}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{seller.total_sales}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">${Number(seller.total_revenue || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sales by Date Table */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales by Date</h2>
          {report?.by_date?.length === 0 ? (
            <p className="text-gray-500">No sales data available.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {report?.by_date?.map((day: any) => (
                    <tr key={day.date}>
                      <td className="px-4 py-3 text-sm text-gray-900">{day.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{day.total_sales}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">${Number(day.total_revenue || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sales Zones Map */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Most Frequent Sales Zones (Lima, Peru)</h2>
        {sales.length === 0 ? (
          <p className="text-gray-500">No sales data available for map.</p>
        ) : (
          <SalesZonesMap sales={sales} />
        )}
      </div>
    </div>
  )
}
