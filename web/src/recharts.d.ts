declare module 'recharts' {
  import { ComponentType, ReactNode } from 'react'

  export interface ChartProps {
    width?: number | string
    height?: number | string
    data?: any[]
    children?: ReactNode
  }

  export const ResponsiveContainer: ComponentType<{ width?: number | string; height?: number | string; children?: ReactNode }>
  export const LineChart: ComponentType<ChartProps & { children?: ReactNode }>
  export const Line: ComponentType<any>
  export const BarChart: ComponentType<ChartProps & { layout?: string; children?: ReactNode }>
  export const Bar: ComponentType<any>
  export const PieChart: ComponentType<ChartProps & { children?: ReactNode }>
  export const Pie: ComponentType<any>
  export const Cell: ComponentType<{ fill?: string; key?: string | number }>
  export const XAxis: ComponentType<any>
  export const YAxis: ComponentType<any>
  export const CartesianGrid: ComponentType<any>
  export const Tooltip: ComponentType<any>
  export const Legend: ComponentType<any>
}

declare module 'leaflet' {
  export class Map {
    constructor(element: HTMLElement, options?: any)
    setView(center: [number, number], zoom: number): this
    remove(): void
    eachLayer(fn: (layer: any) => void): void
    removeLayer(layer: any): void
  }

  export class CircleMarker {
    constructor(latlng: [number, number], options?: any)
    bindPopup(content: string): this
    addTo(map: Map): this
  }

  export function tileLayer(urlTemplate: string, options?: any): any
  export function map(element: HTMLElement, options?: any): Map
  export function circleMarker(latlng: [number, number], options?: any): CircleMarker
}
