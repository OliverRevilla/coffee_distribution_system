import { useEffect, useState, useMemo } from 'react'
import { reportsApi, sellersApi, salesApi } from '../../services/api'
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import SalesZonesMap from '../../components/SalesZonesMap'

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

export default function AdminDashboardPage() {
  const [report, setReport] = useState<any>(null)
  const [sellers, setSellers] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [reportResult, sellersResult, salesResult] = await Promise.allSettled([
        reportsApi.getSalesReport(),
        sellersApi.list(),
        salesApi.list(),
      ])

      if (reportResult.status === 'fulfilled') {
        setReport(reportResult.value.data)
      }
      if (sellersResult.status === 'fulfilled') {
        setSellers(sellersResult.value.data.sellers || [])
      }
      if (salesResult.status === 'fulfilled') {
        setSales(salesResult.value.data.sales || [])
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const salesByDate = useMemo(() => {
    return (report?.by_date || []).map((d: any) => ({
      date: d.date,
      revenue: Number(d.total_revenue || 0),
      sales: d.total_sales,
    })).reverse()
  }, [report])

  const salesByVariant = useMemo(() => {
    return (report?.by_variant || []).map((v: any) => ({
      name: v.variant,
      value: Number(v.total_revenue || 0),
      quantity: v.total_quantity,
    }))
  }, [report])

  const top10Sales = useMemo(() => {
    return [...sales]
      .sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0))
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        label: `${s.customer_name || 'Unknown'} - ${s.variant_name || ''}`,
        customer: s.customer_name || 'Unknown',
        seller: s.seller_name || '',
        variant: s.variant_name || '',
        total: Number(s.total_amount || 0),
        quantity: s.quantity,
        date: s.sale_date ? new Date(s.sale_date).toLocaleDateString() : '',
      }))
  }, [sales])

  const totalRevenue = useMemo(
    () => sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
    [sales]
  )

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
            ${totalRevenue.toFixed(2)}
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

      {/* Row 1: Sales Trend + Revenue by Product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

      {/* Row 2: Top 10 Sales + Sales Zones Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top 10 Sales by Total</h2>
          {top10Sales.length === 0 ? (
            <p className="text-gray-500">No sales data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={top10Sales} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="customer" tick={{ fontSize: 10 }} width={110} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Total']}
                  labelFormatter={(_: string, payload: any[]) => {
                    if (!payload?.length) return ''
                    const d = payload[0].payload
                    return `${d.variant} - ${d.date}`
                  }}
                />
                <Bar dataKey="total" name="Total ($)" radius={[0, 4, 4, 0]}>
                  {top10Sales.map((_: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Most Frequent Sales Zones</h2>
          {sales.length === 0 ? (
            <p className="text-gray-500">No sales data available for map.</p>
          ) : (
            <SalesZonesMap sales={sales} />
          )}
        </div>
      </div>
    </div>
  )
}
