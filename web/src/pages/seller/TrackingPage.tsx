import { useEffect, useState, useMemo } from 'react'
import { customerTrackingApi } from '../../services/api'

interface CustomerTracking {
  id: number
  seller_id: number
  seller_name: string
  name: string
  nickname: string | null
  district: string | null
  phone: string | null
  cycle_days: number
  last_sale_date: string | null
  last_sale_amount: number
  next_expected_date: string | null
  days_since_last_sale: number | null
  status: 'active' | 'inactive'
}

type FilterStatus = 'all' | 'active' | 'inactive'

export default function TrackingPage() {
  const [customers, setCustomers] = useState<CustomerTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await customerTrackingApi.getTracking()
        setCustomers(res.data.customers || [])
      } catch (err) {
        console.error('Error fetching tracking data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return customers
    return customers.filter((c) => c.status === filter)
  }, [customers, filter])

  const summary = useMemo(() => {
    const active = customers.filter((c) => c.status === 'active').length
    const inactive = customers.filter((c) => c.status === 'inactive').length
    const overdue = customers.filter((c) => {
      if (!c.next_expected_date) return false
      return new Date(c.next_expected_date) < new Date()
    }).length
    return { total: customers.length, active, inactive, overdue }
  }, [customers])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  const getStatusColor = (status: string) => {
    return status === 'active'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800'
  }

  const getOverdueColor = (nextDate: string | null) => {
    if (!nextDate) return ''
    const next = new Date(nextDate)
    const today = new Date()
    if (next < today) return 'text-red-600 font-semibold'
    const daysUntil = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil <= 3) return 'text-amber-600 font-semibold'
    return 'text-gray-900'
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Customer Order Tracking</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Total Customers</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{summary.total}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Active</div>
          <div className="mt-1 text-2xl font-bold text-green-600">{summary.active}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Inactive (3+ months)</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{summary.inactive}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-500">Overdue Orders</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{summary.overdue}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-6">
        {(['all', 'active', 'inactive'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              filter === status
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-1">
                ({status === 'active' ? summary.active : summary.inactive})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tracking Table */}
      {filtered.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">No customers match the selected filter.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    District
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Sale
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cycle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Expected
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Since
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      {c.nickname && <div className="text-xs text-gray-500">{c.nickname}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {c.district || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(c.last_sale_date)}
                      {c.last_sale_amount > 0 && (
                        <div className="text-xs text-gray-500">
                          ${c.last_sale_amount.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {c.cycle_days} days
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm ${getOverdueColor(c.next_expected_date)}`}>
                      {formatDate(c.next_expected_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {c.days_since_last_sale !== null ? `${c.days_since_last_sale}d` : 'Never'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
