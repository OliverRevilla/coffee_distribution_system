import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'

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

export default function SellerRegisterPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    }
  }, [user, navigate])

  const provinces = useMemo(() => {
    if (!department || !PERU_DEPARTMENTS[department]) return []
    return Object.keys(PERU_DEPARTMENTS[department])
  }, [department])

  const districts = useMemo(() => {
    if (!department || !province) return []
    return PERU_DEPARTMENTS[department]?.[province] || []
  }, [department, province])

  const handleDepartmentChange = (value: string) => {
    setDepartment(value)
    setProvince('')
    setDistrict('')
  }

  const handleProvinceChange = (value: string) => {
    setProvince(value)
    setDistrict('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !fullName.trim() || !password) {
      setError('All fields are required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const residencyParts = ['Perú', department, province, district].filter(Boolean)
    const residencyStr = residencyParts.length > 1 ? residencyParts.join(', ') : undefined

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register/seller`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          dni: dni.trim() || undefined,
          phone: phone.trim() || undefined,
          residency: residencyStr,
          password,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Registration failed')
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-3xl font-bold text-amber-600">☕ Cafe Distribution</h1>
          <p className="text-green-600 font-medium">Registration successful!</p>
          <p className="text-gray-600">You can now sign in with your credentials.</p>
          <Link
            to="/login/seller"
            className="inline-block w-full py-3 px-4 border border-transparent text-sm font-medium rounded-md text-center text-white bg-amber-600 hover:bg-amber-700"
          >
            Go to Seller Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-600">☕ Cafe Distribution</h1>
          <p className="mt-2 text-gray-600">Seller Registration</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-1">
              DNI / Passport
            </label>
            <input
              id="dni"
              type="text"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="12345678"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="999888777"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Residency</label>
            <div className="bg-gray-50 rounded-md px-3 py-2 text-xs text-gray-500 mb-2">Perú</div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={department}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Depto.</option>
                {Object.keys(PERU_DEPARTMENTS).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                disabled={!department}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100"
              >
                <option value="">Prov.</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!province}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100"
              >
                <option value="">Distrito</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Register as Seller'}
          </button>
        </form>
        <div className="text-center mt-4">
          <Link to="/login/seller" className="text-sm text-amber-600 hover:text-amber-700">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
