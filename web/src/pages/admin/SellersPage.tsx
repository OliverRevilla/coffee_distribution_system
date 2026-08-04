import { useEffect, useState, useMemo } from 'react'
import api from '../../services/api'

const PERU_DEPARTMENTS: Record<string, Record<string, string[]>> = {
  'Lima': {
    'Lima': ['Cercado de Lima', 'Ancón', 'Ate', 'Barranco', 'Breña', 'Carabayllo', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas', 'El Agustino', 'Independencia', 'Jesús María', 'Jesús Nazareno', 'La Molina', 'La Victoria', 'Lince', 'Los Olivos', 'Lurigancho', 'Lurín', 'Magdalena del Mar', 'Magdalena Vieja', 'Maringá', 'Matta Sur', 'Pachacámac', 'Pachacutec', 'Punta Hermosa', 'Punta Negra', 'Rímac', 'San Bartolo', 'San Borja', 'San Isidro', 'San Martín de Porres', 'San Juan de Miraflores', 'San Juan de Lurigancho', 'San Luis', 'San Miguel', 'Santa Anita', 'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco', 'Surquillo', 'Villa El Salvador', 'Villa María del Triunfo'],
  },
  'Arequipa': {
    'Arequipa': ['Arequipa', 'Alto Selva Alegre', 'Cayma', 'Cerro Colorado', 'Characato', 'Chiguata', 'Jacobo Hunter', 'La Joya', 'Mariano Melgar', 'Miraflores', 'Mollebaya', 'Paucarpata', 'Pocsi', 'Polobaya', 'Quequeña', 'Sabandía', 'Sachaca', 'San Juan de Siguas', 'San Juan de Tarucani', 'Santa Isabel de Siguas', 'Santa Rita de Siguas', 'Socabaya', 'Tiabaya', 'Uchumayo', 'Vítor', 'Yanahuara', 'Yarabamba', 'Yura'],
  },
  'Cusco': {
    'Cusco': ['Cusco', 'Acomayo', 'Calca', 'Chincheros', 'Coropuna', 'Espinar', 'La Convención', 'Paruro', 'Paucartambo', 'Quispicanchi', 'Urubamba'],
  },
  'Junín': {
    'Huancayo': ['Huancayo', 'Chupaca', 'Concepción', 'Jauja', 'Junín', 'Satipo', 'Tarma'],
  },
  'Piura': {
    'Piura': ['Piura', 'Ayabaca', 'Huancabamba', 'Morropón', 'Paita', 'Sechura', 'Sullana', 'Talara'],
  },
  'La Libertad': {
    'Trujillo': ['Trujillo', 'Ascope', 'Chepen', 'Julcán', 'Otuzco', 'Pacasmayo', 'Pataz', 'Sánchez Carrión', 'Santiago de Chuco', 'Virú'],
  },
  'Lambayeque': {
    'Chiclayo': ['Chiclayo', 'Ferreñafe', 'Lambayeque'],
  },
  'Callao': {
    'Callao': ['Callao', 'Bellavista', 'Carmen de la Legua', 'La Perla', 'La Punta', 'Ventanilla'],
  },
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    dni: '',
    phone: '',
  })
  const [dept, setDept] = useState('')
  const [prov, setProv] = useState('')
  const [dist, setDist] = useState('')

  useEffect(() => {
    fetchSellers()
  }, [])

  const provinces = useMemo(() => {
    if (!dept || !PERU_DEPARTMENTS[dept]) return []
    return Object.keys(PERU_DEPARTMENTS[dept])
  }, [dept])

  const districts = useMemo(() => {
    if (!dept || !prov) return []
    return PERU_DEPARTMENTS[dept]?.[prov] || []
  }, [dept, prov])

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

  const resetForm = () => {
    setFormData({ email: '', full_name: '', password: '', dni: '', phone: '' })
    setDept('')
    setProv('')
    setDist('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const residencyParts = ['Perú', dept, prov, dist].filter(Boolean)
    try {
      await api.post('/auth/register', {
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password,
        dni: formData.dni || undefined,
        phone: formData.phone || undefined,
        residency: residencyParts.length > 1 ? residencyParts.join(', ') : undefined,
        role: 'seller',
      })
      setShowAddModal(false)
      resetForm()
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DNI</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Residency</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sellers.map((seller) => (
              <tr key={seller.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{seller.full_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{seller.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{seller.dni || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{seller.phone || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{seller.residency || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    seller.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {seller.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(seller.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleToggleStatus(seller.id, seller.status)}
                    className={seller.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
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

      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Seller</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input type="text" required value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" required value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">DNI / Passport</label>
                <input type="text" value={formData.dni} placeholder="12345678"
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input type="tel" value={formData.phone} placeholder="999888777"
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Residency</label>
                <div className="bg-gray-50 rounded-md px-3 py-2 text-xs text-gray-500 mb-2">Perú</div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={dept} onChange={(e) => { setDept(e.target.value); setProv(''); setDist('') }}
                    className="px-2 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500">
                    <option value="">Depto.</option>
                    {Object.keys(PERU_DEPARTMENTS).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={prov} onChange={(e) => { setProv(e.target.value); setDist('') }} disabled={!dept}
                    className="px-2 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 disabled:bg-gray-100">
                    <option value="">Prov.</option>
                    {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={dist} onChange={(e) => setDist(e.target.value)} disabled={!prov}
                    className="px-2 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 disabled:bg-gray-100">
                    <option value="">Distrito</option>
                    {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input type="password" required minLength={6} value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => { setShowAddModal(false); resetForm() }}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700">
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
