import { useEffect, useState } from 'react'
import { reportsApi, sellersApi } from '../../services/api'

export default function AdminDashboardPage() {
  const [report, setReport] = useState<any>(null)
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportRes, sellersRes] = await Promise.all([
          reportsApi.getSalesReport(),
          sellersApi.list(),
        ])
        setReport(reportRes.data)
        setSellers(sellersRes.data.sellers || [])
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
            ${report?.summary?.total_revenue?.toFixed(2) || '0.00'}
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

      {/* Sales by Seller */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Sales by Seller</h2>
        {report?.by_seller?.length === 0 ? (
          <p className="text-gray-500">No sales data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report?.by_seller?.map((seller: any) => (
                  <tr key={seller.seller}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {seller.seller}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {seller.total_sales}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${seller.total_revenue?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Sales by Date */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Sales by Date (Last 30 Days)</h2>
        {report?.by_date?.length === 0 ? (
          <p className="text-gray-500">No sales data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sales Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report?.by_date?.map((day: any) => (
                  <tr key={day.date}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.total_sales}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${day.total_revenue?.toFixed(2)}
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
