import { useEffect, useRef } from 'react'
import _L from 'leaflet'

const L = _L as any

interface DistrictData {
  district: string
  count: number
  revenue: number
}

interface DistrictBubblesMapProps {
  districts: DistrictData[]
}

const LIMA_CENTER: [number, number] = [-12.05, -77.03]

const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Jesús María': [-12.08, -77.03],
  'Miraflores': [-12.12, -77.03],
  'San Isidro': [-12.10, -77.04],
  'Barranco': [-12.15, -77.02],
  'San Borja': [-12.11, -76.995],
  'Surco': [-12.14, -76.99],
  'La Molina': [-12.08, -76.95],
  'Pueblo Libre': [-12.07, -77.04],
  'Lince': [-12.08, -77.032],
  'Magdalena del Mar': [-12.09, -77.06],
  'San Miguel': [-12.08, -77.08],
  'Breña': [-12.06, -77.05],
  'Cercado de Lima': [-12.045, -77.03],
  'Rímac': [-12.025, -77.05],
  'Los Olivos': [-12.015, -77.05],
  'San Martín de Porres': [-12.00, -77.05],
  'Comas': [-11.95, -77.05],
  'Independencia': [-11.98, -77.05],
  'San Juan de Lurigancho': [-12.00, -76.98],
  'Ate': [-12.03, -76.95],
  'Santa Anita': [-12.04, -77.00],
  'Unknown': [-12.05, -77.03],
}

export default function DistrictBubblesMap({ districts }: DistrictBubblesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView(LIMA_CENTER, 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const markers = L.layerGroup().addTo(map)
    mapRef.current = map
    markersRef.current = markers

    setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!markersRef.current) return
    markersRef.current.clearLayers()

    const maxCount = Math.max(...districts.map((d) => d.count), 1)

    districts.forEach((d) => {
      const coords = DISTRICT_COORDS[d.district] || DISTRICT_COORDS['Unknown']
      const radius = 8 + (d.count / maxCount) * 25
      const opacity = 0.4 + (d.count / maxCount) * 0.5

      const circle = L.circleMarker(coords, {
        radius,
        fillColor: '#f59e0b',
        color: '#d97706',
        weight: 2,
        opacity,
        fillOpacity: opacity,
      })

      circle.bindPopup(
        `<div style="text-align:center">
          <strong>${d.district}</strong><br/>
          ${d.count} sale${d.count !== 1 ? 's' : ''}<br/>
          Revenue: $${d.revenue.toFixed(2)}
        </div>`
      )

      markersRef.current!.addLayer(circle)
    })
  }, [districts])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '280px', borderRadius: '8px' }}
    />
  )
}
