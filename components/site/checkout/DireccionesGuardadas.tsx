'use client'

/**
 * Con sesión: las direcciones guardadas del cliente como tarjetas + «Usar otra dirección» (Figma
 * «16 Sitio web» › Checkout v2, C5). Elegir una llena la dirección igual que el botón de hoy.
 */

import { MapPin, Plus } from 'lucide-react'

export interface DireccionGuardada {
  id: number
  label: string
  address_line1: string
  city: string
  department?: string
  country_code?: string
  is_default?: boolean
}

export function DireccionesGuardadas({
  direcciones,
  elegidaId,
  usandoOtra,
  onElegir,
  onOtra,
  color,
}: {
  direcciones: readonly DireccionGuardada[]
  /** La que coincide con la dirección escrita (null si ninguna). */
  elegidaId: number | null
  usandoOtra: boolean
  onElegir: (d: DireccionGuardada) => void
  onOtra: () => void
  color: string
}) {
  if (direcciones.length === 0) return null
  return (
    <div data-direcciones-guardadas="">
      <p className="mb-2 text-sm font-medium text-gray-700">Tus direcciones</p>
      <div className="space-y-2" role="radiogroup" aria-label="Tus direcciones guardadas">
        {direcciones.map((d) => {
          const elegida = !usandoOtra && elegidaId === d.id
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={elegida}
              onClick={() => onElegir(d)}
              className="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left"
              style={elegida ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 6%, white)` } : { borderColor: '#E5E7EB' }}
            >
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color }} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">
                  {d.label || 'Dirección'}
                  {d.is_default && <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">Principal</span>}
                </span>
                <span className="block text-xs text-gray-500">{d.address_line1}{d.city ? `, ${d.city}` : ''}</span>
              </span>
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={usandoOtra}
          onClick={onOtra}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed p-3.5 text-left text-sm font-medium"
          style={usandoOtra ? { borderColor: color, color } : { borderColor: '#D1D5DB', color: '#374151' }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Usar otra dirección
        </button>
      </div>
    </div>
  )
}
