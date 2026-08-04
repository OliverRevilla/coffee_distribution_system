import { useEffect, useState, useMemo } from 'react'
import { salesApi, customersApi, variantsApi } from '../../services/api'

interface Customer {
  id: number
  name: string
  nickname: string | null
  district: string | null
  phone: string | null
  payment_mode: 'cash' | 'credit'
}

interface Variant {
  id: number
  name: string
  sku: string
  price: number
  category: string
}

interface Sale {
  id: number
  seller_id: number
  seller_name: string
  customer_id: number | null
  customer_name: string | null
  customer_district: string | null
  variant_id: number
  variant_name: string
  sku: string
  category: string
  presentation: string
  quantity: number
  unit_price: number
  total_amount: number
  sale_date: string
  payment_date: string | null
  expected_payment_date: string | null
  partial_payments: number
  remanent_payment: number
  status: 'pending' | 'completed'
  notes: string | null
}

type Step = 'customer' | 'product' | 'payment' | 'review'

interface SaleForm {
  customer_id: number | null
  customer_search: string
  new_customer_name: string
  new_customer_phone: string
  new_customer_address: string
  new_customer_district: string
  new_customer_dni: string
  new_customer_ruc: string
  new_customer_payment_mode: 'cash' | 'credit'
  variant_id: number | null
  presentation: 'granel' | '250gr' | '1kg'
  quantity: number
  sale_date: string
  payment_date: string
  expected_payment_date: string
  partial_payments: number
  notes: string
}

const emptyForm: SaleForm = {
  customer_id: null,
  customer_search: '',
  new_customer_name: '',
  new_customer_phone: '',
  new_customer_address: '',
  new_customer_district: '',
  new_customer_dni: '',
  new_customer_ruc: '',
  new_customer_payment_mode: 'cash',
  variant_id: null,
  presentation: 'granel',
  quantity: 1,
  sale_date: new Date().toISOString().split('T')[0],
  payment_date: '',
  expected_payment_date: '',
  partial_payments: 0,
  notes: '',
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState<Step>('customer')
  const [form, setForm] = useState<SaleForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const fetchData = async () => {
    try {
      const [salesRes, customersRes, variantsRes] = await Promise.all([
        salesApi.list(),
        customersApi.list(),
        variantsApi.list(),
      ])
      setSales(salesRes.data.sales || [])
      setCustomers(customersRes.data.customers || [])
      setVariants(variantsRes.data.variants || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredCustomers = useMemo(() => {
    if (!form.customer_search) return customers
    const q = form.customer_search.toLowerCase()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q)) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    )
  }, [customers, form.customer_search])

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === form.variant_id),
    [variants, form.variant_id]
  )

  const computedTotal = useMemo(() => {
    if (!selectedVariant) return 0
    return selectedVariant.price * form.quantity
  }, [selectedVariant, form.quantity])

  const computedRemanent = useMemo(
    () => computedTotal - form.partial_payments,
    [computedTotal, form.partial_payments]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'quantity' || name === 'partial_payments' ? Number(value) : value,
      ...(name === 'customer_search' ? { customer_id: null } : {}),
    }))
  }

  const selectCustomer = (c: Customer) => {
    setForm((prev) => ({
      ...prev,
      customer_id: c.id,
      customer_search: `${c.name}${c.nickname ? ` (${c.nickname})` : ''}`,
      new_customer_payment_mode: c.payment_mode,
    }))
    setStep('product')
  }

  const selectNewCustomer = () => {
    setStep('product')
  }

  const openNew = () => {
    setForm(emptyForm)
    setEditingId(null)
    setStep('customer')
    setError('')
    setShowForm(true)
  }

  const openEdit = (sale: Sale) => {
    const saleDate = sale.sale_date ? sale.sale_date.split('T')[0] : ''
    const payDate = sale.payment_date ? sale.payment_date.split('T')[0] : ''
    const expDate = sale.expected_payment_date ? sale.expected_payment_date.split('T')[0] : ''

    setForm({
      customer_id: sale.customer_id,
      customer_search: sale.customer_name || '',
      new_customer_name: '',
      new_customer_phone: '',
      new_customer_address: '',
      new_customer_district: '',
      new_customer_dni: '',
      new_customer_ruc: '',
      new_customer_payment_mode: 'cash',
      variant_id: sale.variant_id,
      presentation: sale.presentation as 'granel' | '250gr' | '1kg',
      quantity: sale.quantity,
      sale_date: saleDate,
      payment_date: payDate,
      expected_payment_date: expDate,
      partial_payments: sale.partial_payments || 0,
      notes: sale.notes || '',
    })
    setEditingId(sale.id)
    setStep('product')
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      let customerId = form.customer_id

      // Create new customer if needed
      if (!customerId && form.new_customer_name.trim()) {
        const custRes = await customersApi.create({
          name: form.new_customer_name,
          phone: form.new_customer_phone || null,
          address: form.new_customer_address || null,
          district: form.new_customer_district || null,
          dni: form.new_customer_dni || null,
          ruc: form.new_customer_ruc || null,
          payment_mode: form.new_customer_payment_mode,
        })
        customerId = custRes.data.id
      }

      if (!customerId) {
        setError('Please select or create a customer')
        setSaving(false)
        return
      }

      if (!form.variant_id) {
        setError('Please select a product')
        setSaving(false)
        return
      }

      const payload = {
        customer_id: customerId,
        variant_id: form.variant_id,
        presentation: form.presentation,
        quantity: form.quantity,
        sale_date: form.sale_date || undefined,
        payment_date: form.payment_date || undefined,
        expected_payment_date: form.expected_payment_date || undefined,
        partial_payments: form.partial_payments || 0,
        notes: form.notes || undefined,
      }

      if (editingId) {
        await salesApi.update(editingId, payload)
      } else {
        await salesApi.create(payload)
      }

      setShowForm(false)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save sale')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium"
        >
          + New Sale
        </button>
      </div>

      {/* Sale Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Sale' : 'Register Sale'}
              </h2>
              {/* Step Indicator */}
              {!editingId && (
                <div className="flex mt-3 space-x-2">
                  {(['customer', 'product', 'payment', 'review'] as Step[]).map((s, i) => (
                    <div
                      key={s}
                      className={`flex items-center text-xs ${
                        step === s ? 'text-amber-600 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center mr-1 ${
                          step === s ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {i + 1}
                      </span>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                      {i < 3 && <span className="mx-1">→</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4">
              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-2 rounded text-sm mb-4">{error}</div>
              )}

              {/* Step: Customer */}
              {step === 'customer' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700">Select or create a customer</h3>

                  {/* Search existing */}
                  <div>
                    <input
                      type="text"
                      placeholder="Search by name, nickname, district, or phone..."
                      value={form.customer_search}
                      onChange={handleChange}
                      name="customer_search"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {form.customer_id ? (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
                      Customer selected: <strong>{form.customer_search}</strong>
                      <button
                        onClick={() => setForm((p) => ({ ...p, customer_id: null, customer_search: '' }))}
                        className="ml-2 text-green-600 underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                      {filteredCustomers.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-500">No customers found</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm flex justify-between"
                          >
                            <span>
                              {c.name}
                              {c.nickname && <span className="text-gray-400 ml-1">({c.nickname})</span>}
                            </span>
                            <span className="text-gray-400">
                              {c.district} · {c.phone || '-'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* New customer inline */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-3">Or register new customer</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        name="new_customer_name"
                        value={form.new_customer_name}
                        onChange={handleChange}
                        placeholder="Name *"
                        className="col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <input
                        type="text"
                        name="new_customer_phone"
                        value={form.new_customer_phone}
                        onChange={handleChange}
                        placeholder="Phone"
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <input
                        type="text"
                        name="new_customer_district"
                        value={form.new_customer_district}
                        onChange={handleChange}
                        placeholder="District"
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <input
                        type="text"
                        name="new_customer_address"
                        value={form.new_customer_address}
                        onChange={handleChange}
                        placeholder="Address"
                        className="col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Payment Mode</label>
                        <select
                          name="new_customer_payment_mode"
                          value={form.new_customer_payment_mode}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="cash">Cash</option>
                          <option value="credit">Credit</option>
                        </select>
                      </div>
                    </div>
                    {form.new_customer_name.trim() && (
                      <button
                        onClick={selectNewCustomer}
                        className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-md text-sm hover:bg-amber-700"
                      >
                        Continue with new customer →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Step: Product */}
              {step === 'product' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Select product</h3>
                    {!editingId && (
                      <button onClick={() => setStep('customer')} className="text-xs text-amber-600 underline">
                        ← Back
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setForm((p) => ({ ...p, variant_id: v.id }))}
                        className={`text-left p-3 rounded-md border text-sm ${
                          form.variant_id === v.id
                            ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{v.name}</span>
                          <span className="text-gray-600">${Number(v.price).toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          SKU: {v.sku} · Category: {v.category}
                        </div>
                      </button>
                    ))}
                  </div>

                  {form.variant_id && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Presentation</label>
                          <select
                            name="presentation"
                            value={form.presentation}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="granel">Granel</option>
                            <option value="250gr">250gr</option>
                            <option value="1kg">1kg</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (1-100)</label>
                          <input
                            type="number"
                            name="quantity"
                            value={form.quantity}
                            onChange={handleChange}
                            min={1}
                            max={100}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-md p-3 text-sm">
                        <div className="flex justify-between">
                          <span>Unit Price:</span>
                          <span>${Number(selectedVariant?.price || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold mt-1">
                          <span>Total:</span>
                          <span>${computedTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      {!editingId && (
                        <button
                          onClick={() => setStep('payment')}
                          className="w-full px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
                        >
                          Continue to Payment →
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step: Payment */}
              {step === 'payment' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Payment details</h3>
                    {!editingId && (
                      <button onClick={() => setStep('product')} className="text-xs text-amber-600 underline">
                        ← Back
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                      <input
                        type="date"
                        name="sale_date"
                        value={form.sale_date}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                      <input
                        type="date"
                        name="payment_date"
                        value={form.payment_date}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Payment Date (Theory)
                    </label>
                    <input
                      type="date"
                      name="expected_payment_date"
                      value={form.expected_payment_date}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Partial Payments ($)
                      </label>
                      <input
                        type="number"
                        name="partial_payments"
                        value={form.partial_payments}
                        onChange={handleChange}
                        min={0}
                        step={0.01}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="bg-gray-50 rounded-md p-3 text-sm">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span>${computedTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>Paid:</span>
                          <span>-${form.partial_payments.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t border-gray-200 mt-1 pt-1">
                          <span>Remaining:</span>
                          <span className={computedRemanent > 0 ? 'text-red-600' : 'text-green-600'}>
                            ${computedRemanent.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      rows={2}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="Optional notes..."
                    />
                  </div>

                  {!editingId && (
                    <button
                      onClick={() => setStep('review')}
                      className="w-full px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
                    >
                      Review Sale →
                    </button>
                  )}
                </div>
              )}

              {/* Step: Review (new sales only) */}
              {step === 'review' && !editingId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Review & Confirm</h3>
                    <button onClick={() => setStep('payment')} className="text-xs text-amber-600 underline">
                      ← Back
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-md p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Customer:</span>
                      <span className="font-medium">{form.customer_search || form.new_customer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Product:</span>
                      <span className="font-medium">{selectedVariant?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Presentation:</span>
                      <span>{form.presentation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quantity:</span>
                      <span>{form.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Unit Price:</span>
                      <span>${Number(selectedVariant?.price || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                      <span>Total:</span>
                      <span>${computedTotal.toFixed(2)}</span>
                    </div>
                    {form.partial_payments > 0 && (
                      <>
                        <div className="flex justify-between text-green-600">
                          <span>Paid:</span>
                          <span>${form.partial_payments.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-red-600">
                          <span>Remaining:</span>
                          <span>${computedRemanent.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {form.sale_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sale Date:</span>
                        <span>{form.sale_date}</span>
                      </div>
                    )}
                    {form.expected_payment_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expected Payment:</span>
                        <span>{form.expected_payment_date}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Confirm Sale'}
                  </button>
                </div>
              )}

              {/* Edit mode: single submit */}
              {editingId && (
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Update Sale'}
                  </button>
                </div>
              )}

              {/* Close button for non-review steps */}
              {step !== 'review' && !editingId && (
                <div className="flex justify-end pt-4 border-t border-gray-200 mt-4">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sales Table */}
      {sales.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">No sales yet. Register your first sale to get started.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pres.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.sale_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">{sale.customer_name || '-'}</div>
                      {sale.customer_district && (
                        <div className="text-xs text-gray-500">{sale.customer_district}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {sale.variant_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {sale.presentation}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${Number(sale.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600">
                      ${Number(sale.partial_payments || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span
                        className={
                          sale.remanent_payment > 0 ? 'text-red-600 font-medium' : 'text-green-600'
                        }
                      >
                        ${Number(sale.remanent_payment || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => openEdit(sale)}
                        className="text-amber-600 hover:text-amber-900"
                      >
                        Edit
                      </button>
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
