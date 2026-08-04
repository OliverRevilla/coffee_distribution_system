import { useEffect, useState, useMemo } from 'react'
import { salesApi } from '../../services/api'

const ROWS_PER_PAGE = 100

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterDay, setFilterDay] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    try {
      const response = await salesApi.list()
      setSales(response.data.sales || [])
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setLoading(false)
    }
  }

  const years = useMemo(() => {
    const set = new Set<string>()
    sales.forEach((s) => {
      if (s.sale_date) set.add(new Date(s.sale_date).getFullYear().toString())
    })
    return Array.from(set).sort().reverse()
  }, [sales])

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (!s.sale_date) return false
      const d = new Date(s.sale_date)
      if (filterYear && d.getFullYear().toString() !== filterYear) return false
      if (filterMonth && (d.getMonth() + 1).toString().padStart(2, '0') !== filterMonth) return false
      if (filterDay && d.getDate().toString().padStart(2, '0') !== filterDay) return false
      if (filterCustomer) {
        const q = filterCustomer.toLowerCase()
        if (!(s.customer_name || '').toLowerCase().includes(q)) return false
      }
      if (filterDistrict) {
        const q = filterDistrict.toLowerCase()
        if (!(s.customer_district || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [sales, filterYear, filterMonth, filterDay, filterCustomer, filterDistrict])

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE)
  const paged = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE
    return filtered.slice(start, start + ROWS_PER_PAGE)
  }, [filtered, page])

  const clearFilters = () => {
    setFilterYear('')
    setFilterMonth('')
    setFilterDay('')
    setFilterCustomer('')
    setFilterDistrict('')
    setPage(1)
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sales Management</h1>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          <button onClick={clearFilters} className="text-xs text-amber-600 hover:text-amber-800">
            Clear all
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setPage(1) }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">All</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">All</option>
              {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Day</label>
            <select value={filterDay} onChange={(e) => { setFilterDay(e.target.value); setPage(1) }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">All</option>
              {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
            <input type="text" value={filterCustomer} placeholder="Search..."
              onChange={(e) => { setFilterCustomer(e.target.value); setPage(1) }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">District</label>
            <input type="text" value={filterDistrict} placeholder="Search..."
              onChange={(e) => { setFilterDistrict(e.target.value); setPage(1) }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>
      </div>

      {/* Results info + Pagination */}
      <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
        <span>{filtered.length} sale{filtered.length !== 1 ? 's' : ''} found</span>
        {totalPages > 1 && (
          <div className="flex items-center space-x-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50">
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50">
              Next
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">District</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paged.map((sale) => (
              <tr key={sale.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(sale.sale_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.seller_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.variant_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sale.quantity}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${Number(sale.unit_price || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${Number(sale.total_amount || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.customer_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.customer_district || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paged.length === 0 && (
          <div className="text-center py-8 text-gray-500">No sales match the filters.</div>
        )}
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center mt-4 space-x-2 text-sm">
          <button onClick={() => setPage(1)} disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
            First
          </button>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
            Prev
          </button>
          <span className="text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
            Next
          </button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
            Last
          </button>
        </div>
      )}
    </div>
  )
}
