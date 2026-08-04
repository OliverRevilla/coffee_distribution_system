import { useEffect, useRef } from 'react'
import _L from 'leaflet'

const L = _L as any

interface SalesZonesMapProps {
  sales: any[]
}

const LIMA_CENTER: [number, number] = [-12.05, -77.03]

function aggregateLocations(sales: any[]) {
  const zones = new Map<string, { lat: number; lng: number; count: number; total: number }>()

  sales.forEach((sale: any) => {
    const lat = parseFloat(sale.gps_latitude)
    const lng = parseFloat(sale.gps_longitude)
    if (isNaN(lat) || isNaN(lng)) return

    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
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
      })

      circle.bindPopup(
        `<div style="text-align:center">
          <strong>${zone.count} sale${zone.count > 1 ? 's' : ''}</strong><br/>
          Revenue: $${zone.total.toFixed(2)}
        </div>`
      )

      markersRef.current!.addLayer(circle)
    })
  }, [sales])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '400px', borderRadius: '8px' }}
    />
  )
}
