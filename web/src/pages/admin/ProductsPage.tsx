import { useEffect, useState } from 'react'
import { productsApi } from '../../services/api'

interface Product {
  id: number
  name: string
  description: string | null
  presentation: string
  recommended_price: number
  category: 'A' | 'B' | 'C'
  is_active: boolean
  created_at: string
}

interface ProductForm {
  name: string
  description: string
  presentation: string
  recommended_price: string
  category: 'A' | 'B' | 'C'
}

const emptyForm: ProductForm = {
  name: '',
  description: '',
  presentation: '',
  recommended_price: '',
  category: 'C',
}

const categoryLabels: Record<string, string> = {
  A: 'Premium',
  B: 'Standard',
  C: 'Economy',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchProducts = async () => {
    try {
      const res = await productsApi.list()
      setProducts(res.data.products || [])
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const openNew = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
    setShowForm(true)
  }

  const openEdit = (p: Product) => {
    setForm({
      name: p.name,
      description: p.description || '',
      presentation: p.presentation,
      recommended_price: String(p.recommended_price),
      category: p.category,
    })
    setEditingId(p.id)
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    if (!form.presentation.trim()) {
      setError('Presentation is required')
      return
    }
    if (!form.recommended_price || parseFloat(form.recommended_price) < 0) {
      setError('Valid recommended price is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        presentation: form.presentation,
        recommended_price: parseFloat(form.recommended_price),
        category: form.category,
      }
      if (editingId) {
        await productsApi.update(editingId, payload)
      } else {
        await productsApi.create(payload)
      }
      setShowForm(false)
      fetchProducts()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this product from the catalog?')) return
    try {
      await productsApi.delete(id)
      fetchProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products Catalog</h1>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium"
        >
          + Add Product
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Manage the product catalog and set recommended prices. Sellers will select from these products and set their own selling prices.
      </p>

      {/* Products Table */}
      {products.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">No products yet. Add your first product to get started.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presentation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rec. Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {p.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {p.presentation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        p.category === 'A'
                          ? 'bg-amber-100 text-amber-800'
                          : p.category === 'B'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {categoryLabels[p.category] || p.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                      ${p.recommended_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {p.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-amber-600 hover:text-amber-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Product' : 'New Product'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presentation *</label>
                <input
                  type="text"
                  name="presentation"
                  value={form.presentation}
                  onChange={handleChange}
                  placeholder="e.g. 250gr, 1kg, granel"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recommended Price *</label>
                  <input
                    type="number"
                    name="recommended_price"
                    value={form.recommended_price}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Price sellers pay to you</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="A">Premium (A)</option>
                    <option value="B">Standard (B)</option>
                    <option value="C">Economy (C)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
