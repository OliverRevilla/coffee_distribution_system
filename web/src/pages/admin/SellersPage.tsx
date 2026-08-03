import { useEffect, useState } from 'react'
import api from '../../services/api'

export default function SellersPage() {
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
  })

  useEffect(() => {
    fetchSellers()
  }, [])

  const fetchSellers = async () => {
    try {
      const response = await api.get('/sellers')
      setSellers(response.data.sellers || [])
    } catch (error) {
      console.error('Error fetching sellers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/auth/register', {
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password,
        role: 'seller',
      })
      setShowAddModal(false)
      setFormData({ email: '', full_name: '', password: '' })
      fetchSellers()
    } catch (error) {
      console.error('Error creating seller:', error)
    }
  }

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    try {
      await api.put(`/sellers/${id}/status`, {
        status: currentStatus === 'active' ? 'inactive' : 'active',
      })
      fetchSellers()
    } catch (error) {
      console.error('Error updating seller status:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Seller Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700"
        >
          Add Seller
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sellers.map((seller) => (
              <tr key={seller.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {seller.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {seller.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {seller.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      seller.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {seller.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(seller.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleToggleStatus(seller.id, seller.status)}
                    className={`${
                      seller.status === 'active'
                        ? 'text-red-600 hover:text-red-900'
                        : 'text-green-600 hover:text-green-900'
                    }`}
                  >
                    {seller.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sellers.length === 0 && (
          <div className="text-center py-8 text-gray-500">No sellers registered yet.</div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Seller</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
