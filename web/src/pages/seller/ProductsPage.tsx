import { useEffect, useState } from 'react'
import { productsApi, sellerProductsApi } from '../../services/api'

interface Product {
  id: number
  name: string
  description: string | null
  presentation: string
  recommended_price: number
  category: 'A' | 'B' | 'C'
}

interface SellerProduct {
  id: number
  product_id: number
  name: string
  description: string | null
  presentation: string
  recommended_price: number
  category: string
  real_price: number
}

const categoryLabels: Record<string, string> = {
  A: 'Premium',
  B: 'Standard',
  C: 'Economy',
}

export default function ProductsPage() {
  const [catalog, setCatalog] = useState<Product[]>([])
  const [myProducts, setMyProducts] = useState<SellerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingProductId, setAddingProductId] = useState<number | null>(null)
  const [addPrice, setAddPrice] = useState('')
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fetchData = async () => {
    try {
      const [catalogRes, myRes] = await Promise.all([
        productsApi.list(),
        sellerProductsApi.list(),
      ])
      setCatalog(catalogRes.data.products || [])
      setMyProducts(myRes.data.seller_products || [])
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const myProductIds = new Set(myProducts.map((sp) => sp.product_id))
  const availableProducts = catalog.filter((p) => !myProductIds.has(p.id))

  const openAdd = (product: Product) => {
    setAddingProductId(product.id)
    setAddPrice('')
    setAddError('')
    setShowAddModal(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addPrice || parseFloat(addPrice) < 0) {
      setAddError('Please enter a valid price')
      return
    }
    setAddSaving(true)
    setAddError('')
    try {
      await sellerProductsApi.add({
        product_id: addingProductId,
        real_price: parseFloat(addPrice),
      })
      setShowAddModal(false)
      fetchData()
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Failed to add product')
    } finally {
      setAddSaving(false)
    }
  }

  const openEdit = (sp: SellerProduct) => {
    setEditingId(sp.id)
    setEditPrice(String(sp.real_price))
    setEditError('')
  }

  const handleEditSave = async (sp_id: number) => {
    if (!editPrice || parseFloat(editPrice) < 0) {
      setEditError('Please enter a valid price')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      await sellerProductsApi.update(sp_id, { real_price: parseFloat(editPrice) })
      setEditingId(null)
      fetchData()
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update price')
    } finally {
      setEditSaving(false)
    }
  }

  const handleRemove = async (sp_id: number) => {
    if (!confirm('Remove this product from your catalog?')) return
    try {
      await sellerProductsApi.remove(sp_id)
      fetchData()
    } catch (err) {
      console.error('Error removing product:', err)
    }
  }

  const addingProduct = catalog.find((p) => p.id === addingProductId)

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Products</h1>
      <p className="text-sm text-gray-500 mb-6">
        Select products from the catalog and set your selling price. Your margin = your price - recommended price.
      </p>

      {/* My Products */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">My Active Products</h2>
        </div>
        {myProducts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            You haven't added any products yet. Browse the catalog below to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presentation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rec. Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Your Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {myProducts.map((sp) => {
                  const margin = sp.real_price - sp.recommended_price
                  const marginPct = sp.recommended_price > 0
                    ? ((margin / sp.recommended_price) * 100).toFixed(0)
                    : '0'
                  return (
                    <tr key={sp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{sp.name}</div>
                        {sp.description && (
                          <div className="text-xs text-gray-500 max-w-xs truncate">{sp.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sp.presentation}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${sp.recommended_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === sp.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              step="0.01"
                              min="0"
                              className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              onClick={() => handleEditSave(sp.id)}
                              disabled={editSaving}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-500 hover:text-gray-700 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-green-700">
                            ${sp.real_price.toFixed(2)}
                          </span>
                        )}
                        {editingId !== sp.id && editError && editingId === sp.id && (
                          <div className="text-xs text-red-600 mt-1">{editError}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          +${margin.toFixed(2)} ({marginPct}%)
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {editingId !== sp.id && (
                          <>
                            <button
                              onClick={() => openEdit(sp)}
                              className="text-amber-600 hover:text-amber-900 mr-3"
                            >
                              Edit Price
                            </button>
                            <button
                              onClick={() => handleRemove(sp.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Catalog */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Available Products</h2>
        </div>
        {availableProducts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            All products from the catalog have been added.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Presentation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rec. Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {availableProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-gray-500 max-w-xs truncate">{p.description}</div>
                      )}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${p.recommended_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => openAdd(p)}
                        className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700"
                      >
                        + Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Price Modal */}
      {showAddModal && addingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Product</h2>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-4 space-y-4">
              {addError && (
                <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm">{addError}</div>
              )}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-900">{addingProduct.name}</div>
                <div className="text-xs text-gray-500">{addingProduct.presentation}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Recommended price: <span className="font-semibold text-green-700">${addingProduct.recommended_price.toFixed(2)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Selling Price *</label>
                <input
                  type="number"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set the price your clients will pay. Margin = Your Price - ${addingProduct.recommended_price.toFixed(2)}
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {addSaving ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
