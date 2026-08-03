import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface SalesZonesMapProps {
  sales: any[]
}

function aggregateLocations(sales: any[]) {
  const zones = new Map<string, { lat: number; lng: number; count: number; total: number }>()

  sales.forEach((sale: any) => {
    const lat = parseFloat(sale.gps_latitude)
    const lng = parseFloat(sale.gps_longitude)
    if (isNaN(lat) || isNaN(lng)) return

    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
    const existing = zones.get(key)
    if (existing) {
      existing.count++
      existing.total += Number(sale.total_amount || 0)
    } else {
      zones.set(key, { lat, lng, count: 1, total: Number(sale.total_amount || 0) })
    }
  })

  return Array.from(zones.values())
}

export default function SalesZonesMap({ sales }: SalesZonesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current).setView([-12.05, -77.03], 12)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    mapInstance.current = map

    return () => {
      map.remove()
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapInstance.current) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const zones = aggregateLocations(sales)
    const maxCount = Math.max(...zones.map((z) => z.count), 1)

    zones.forEach((zone) => {
      const radius = 10 + (zone.count / maxCount) * 30
      const opacity = 0.4 + (zone.count / maxCount) * 0.4

      const circle = L.circleMarker([zone.lat, zone.lng], {
        radius,
        fillColor: '#f59e0b',
        color: '#d97706',
        weight: 2,
        opacity,
        fillOpacity: opacity,
      }).addTo(mapInstance.current)

      circle.bindPopup(
        `<div style="text-align:center">
          <strong>${zone.count} sale${zone.count > 1 ? 's' : ''}</strong><br/>
          Revenue: $${zone.total.toFixed(2)}
        </div>`
      )

      markersRef.current.push(circle)
    })
  }, [sales])

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '400px', borderRadius: '8px' }}
    />
  )
}
