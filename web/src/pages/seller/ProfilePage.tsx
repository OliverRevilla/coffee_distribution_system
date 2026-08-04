import { useEffect, useState, useMemo } from 'react'
import { profileApi } from '../../services/api'

interface Profile {
  id: number
  email: string
  full_name: string
  role: string
  status: string
  dni: string | null
  phone: string | null
  residency: string | null
  created_at: string
}

const PERU_DEPARTMENTS: Record<string, Record<string, string[]>> = {
  'Lima': {
    'Lima': ['Cercado de Lima', 'Ancón', 'Ate', 'Barranco', 'Breña', 'Carabayllo', 'Chaclacayo', 'Chorrillos', 'Cieneguilla', 'Comas', 'El Agustino', 'Independencia', 'Jesús María', 'Jesús Nazareno', 'La Molina', 'La Victoria', 'Lince', 'Los Olivos', 'Lurigancho', 'Lurín', 'Magdalena del Mar', 'Magdalena Vieja', 'Maringá', 'Matta Sur', 'Pachacámac', 'Pachacutec', 'Punta Hermosa', 'Punta Negra', 'Rímac', 'San Bartolo', 'San Borja', 'San Isidro', 'San Martín de Porres', 'San Martín de Porres', 'San Juan de Miraflores', 'San Juan de Lurigancho', 'San Luis', 'San Miguel', 'Santa Anita', 'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco', 'Surquillo', 'Villa El Salvador', 'Villa María del Triunfo'],
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await profileApi.get()
        const p = res.data
        setProfile(p)
        setFullName(p.full_name || '')
        setDni(p.dni || '')
        setPhone(p.phone || '')
        if (p.residency) {
          const parts = p.residency.split(',').map((s: string) => s.trim())
          if (parts.length >= 2) setDepartment(parts[1] || '')
          if (parts.length >= 3) setProvince(parts[2] || '')
          if (parts.length >= 4) setDistrict(parts[3] || '')
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

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

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setProfileMsg({ type: 'error', text: 'Full name is required' })
      return
    }
    setProfileSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      const residencyParts = ['Perú', department, province, district].filter(Boolean)
      await profileApi.update({
        full_name: fullName,
        dni: dni || null,
        phone: phone || null,
        residency: residencyParts.length > 1 ? residencyParts.join(', ') : null,
      })
      setProfileMsg({ type: 'success', text: 'Profile updated successfully' })
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPwd) {
      setPwdMsg({ type: 'error', text: 'Current password is required' })
      return
    }
    if (!newPwd || newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }
    setPwdSaving(true)
    setPwdMsg({ type: '', text: '' })
    try {
      await profileApi.changePassword({ current_password: currentPwd, new_password: newPwd })
      setPwdMsg({ type: 'success', text: 'Password changed successfully' })
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password' })
    } finally {
      setPwdSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h2>
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-600">
            <div><span className="font-medium text-gray-700">Email:</span> {profile?.email}</div>
            <div><span className="font-medium text-gray-700">Role:</span> {profile?.role}</div>
            <div><span className="font-medium text-gray-700">Member since:</span> {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}</div>
          </div>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileMsg.type && (
              <div className={`px-4 py-2 rounded text-sm ${profileMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {profileMsg.text}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                <input
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Residency - Structured */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Residency</label>
              <div className="bg-gray-50 rounded-md px-3 py-2 text-xs text-gray-500 mb-2">Perú</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Departamento</label>
                  <select
                    value={department}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select...</option>
                    {Object.keys(PERU_DEPARTMENTS).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Provincia</label>
                  <select
                    value={province}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    disabled={!department}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  >
                    <option value="">Select...</option>
                    {provinces.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Distrito</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    disabled={!province}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                  >
                    <option value="">Select...</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Change Password</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {pwdMsg.type && (
              <div className={`px-4 py-2 rounded text-sm ${pwdMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {pwdMsg.text}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
              <input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={pwdSaving}
              className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {pwdSaving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
