'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Globe, type LucideIcon } from 'lucide-react'
import { useCurrency } from './CurrencyProvider'
import { IconoConCirculo, propsTrazoIcono } from './header/IconoEncabezado'
import { ContenedorIcono, trazoContenedor, type ColoresCaja } from './header/ContenedorIcono'
import type { ContenedorIconos } from '@/lib/website/constructorEncabezado'
import { ordenarMonedas } from '@/lib/site/ordenMonedas'

/**
 * Color de la opción elegida: el primario del sitio (OrganizationLayoutCliente), no `primaryColor`,
 * que en HeaderPorZonas es el color del ícono y puede ser blanco sobre un encabezado oscuro.
 */
const COLOR_MARCA = 'var(--primary-color, #111827)'

export function CurrencySelector({ primaryColor, icon: Icon = Globe, compactClassName = '', heredarColor = false, relleno = false, circulo = false, contenedor = null, colores }: { primaryColor?: string; icon?: LucideIcon; compactClassName?: string; heredarColor?: boolean; relleno?: boolean; circulo?: boolean; contenedor?: ContenedorIconos | null; colores?: ColoresCaja }) {
  const { currency, baseCurrency, availableCurrencies, setCurrency, loading } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', tecla)
    }
  }, [])

  // Mostrar siempre si hay monedas disponibles, incluso si solo hay 1
  if (loading) return null
  if (availableCurrencies.length === 0) return null

  // compactClassName sobreescribe las clases base del botón e iconos
  const hasCompact = compactClassName !== ''

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-md hover:bg-[var(--header-hover)] transition-colors ${heredarColor ? 'text-current' : 'text-gray-600 dark:text-gray-300'} ${hasCompact ? compactClassName : 'px-2 py-1.5 text-sm'}`}
        aria-label="Seleccionar moneda"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {contenedor ? (
          <ContenedorIcono base={contenedor} clave="currency" colores={colores || { primary: primaryColor || '#111827', accent: primaryColor || '#111827', secondary: primaryColor || '#111827' }}>
            <Icon style={trazoContenedor(contenedor, 'currency', relleno)} />
          </ContenedorIcono>
        ) : (
          <IconoConCirculo circulo={circulo} primaryColor={primaryColor || '#111827'} tamano={hasCompact ? 'sm' : 'md'}>
            <Icon className={hasCompact ? 'h-3 w-3 md:h-4 md:w-4' : 'h-4 w-4'} {...propsTrazoIcono(relleno)} />
          </IconoConCirculo>
        )}
        <span className="font-medium">{currency}</span>
        <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''} ${hasCompact ? 'h-2.5 w-2.5 md:h-3 md:w-3' : 'h-3 w-3'}`} />
      </button>

      {/*
        Panel siempre blanco y con colores propios: no hereda el texto claro de un encabezado
        oscuro (las opciones salían invisibles) ni pasa a oscuro con la clase `dark`.
      */}
      {open && (
        <div
          role="listbox"
          aria-label="Moneda"
          className={`absolute right-0 top-full mt-1 ${hasCompact ? 'w-44 md:w-56' : 'w-56'} max-h-[320px] overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white py-1 text-left text-[#111827] shadow-xl z-[1000] [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent]`}
        >
          {ordenarMonedas(availableCurrencies, baseCurrency).map((c) => {
            const elegida = c.code === currency
            return (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={elegida}
                onClick={() => { setCurrency(c.code); setOpen(false) }}
                className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
                style={elegida ? { backgroundColor: `color-mix(in srgb, ${COLOR_MARCA} 10%, white)` } : undefined}
              >
                <span className="w-10 shrink-0 font-semibold" style={{ color: elegida ? COLOR_MARCA : '#111827' }}>{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-xs" style={{ color: '#4B5563' }}>{c.country}</span>
                {elegida && <Check aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: COLOR_MARCA }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
