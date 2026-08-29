'use client'

import { useState, useRef, useEffect, type ComponentType } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { useCurrency } from './CurrencyProvider'

export function CurrencySelector({ primaryColor, icon: Icon = Globe, compactClassName = '' }: { primaryColor?: string; icon?: ComponentType<{ className?: string }>; compactClassName?: string }) {
  const { currency, availableCurrencies, setCurrency, loading } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
        className={`flex items-center gap-1 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${hasCompact ? compactClassName : 'px-2 py-1.5 text-sm'}`}
        aria-label="Seleccionar moneda"
      >
        <Icon className={hasCompact ? 'h-3 w-3 md:h-4 md:w-4' : 'h-4 w-4'} />
        <span className="font-medium">{currency}</span>
        <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''} ${hasCompact ? 'h-2.5 w-2.5 md:h-3 md:w-3' : 'h-3 w-3'}`} />
      </button>

      {open && (
        <div className={`absolute right-0 mt-1 ${hasCompact ? 'w-36 md:w-48' : 'w-48'} bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-y-auto`}>
          {availableCurrencies.map(c => (
            <button
              key={c.code}
              onClick={() => { setCurrency(c.code); setOpen(false) }}
              className={`w-full text-left px-3 ${hasCompact ? 'py-1.5 text-xs md:py-2 md:text-sm' : 'py-2 text-sm'} hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between ${c.code === currency ? 'font-semibold' : ''}`}
              style={c.code === currency && primaryColor ? { color: primaryColor } : undefined}
            >
              <span>{c.code}</span>
              <span className="text-xs text-gray-400">{c.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
