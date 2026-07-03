'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { useCurrency } from './CurrencyProvider'

export function CurrencySelector({ primaryColor }: { primaryColor?: string }) {
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

  if (loading || availableCurrencies.length <= 1) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Seleccionar moneda"
      >
        <Globe className="h-4 w-4" />
        <span className="font-medium">{currency}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {availableCurrencies.map(c => (
            <button
              key={c.code}
              onClick={() => { setCurrency(c.code); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between ${c.code === currency ? 'font-semibold' : ''}`}
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
