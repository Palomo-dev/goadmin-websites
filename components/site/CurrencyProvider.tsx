'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

interface AvailableCurrency {
  code: string
  country: string
  locale: string
}

interface CurrencyContextValue {
  baseCurrency: string
  currency: string
  conversionRate: number
  locale: string
  decimals: number
  availableCurrencies: AvailableCurrency[]
  loading: boolean
  setCurrency: (code: string) => void
  convert: (value: number) => number
  formatPrice: (value: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue>({
  baseCurrency: 'COP',
  currency: 'COP',
  conversionRate: 1,
  locale: 'es-CO',
  decimals: 0,
  availableCurrencies: [],
  loading: false,
  setCurrency: () => {},
  convert: (v) => v,
  formatPrice: (v) => `$${Math.round(v).toLocaleString('es-CO')}`,
})

const STORAGE_KEY = 'site_currency'

export function CurrencyProvider({ children, showCurrencyCode = false, currencyPosition = 'left' }: { children: React.ReactNode; showCurrencyCode?: boolean; currencyPosition?: 'left' | 'right' }) {
  const [state, setState] = useState({
    baseCurrency: 'COP',
    currency: 'COP',
    conversionRate: 1,
    locale: 'es-CO',
    decimals: 0,
    availableCurrencies: [] as AvailableCurrency[],
    loading: true,
  })

  const fetchCurrency = useCallback(async (manualCode?: string) => {
    try {
      const url = manualCode ? `/api/currency?currency=${manualCode}` : '/api/currency'
      const res = await fetch(url)
      if (!res.ok) throw new Error('currency fetch failed')
      const data = await res.json()
      setState({
        baseCurrency: data.baseCurrency,
        currency: data.targetCurrency,
        conversionRate: data.conversionRate,
        locale: data.locale,
        decimals: data.decimals,
        availableCurrencies: data.availableCurrencies || [],
        loading: false,
      })
    } catch {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    let manual: string | undefined
    try {
      manual = localStorage.getItem(STORAGE_KEY) || undefined
    } catch { /* ignore */ }
    fetchCurrency(manual)
  }, [fetchCurrency])

  const setCurrency = useCallback((code: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch { /* ignore */ }
    fetchCurrency(code)
  }, [fetchCurrency])

  const value = useMemo<CurrencyContextValue>(() => {
    const convert = (v: number) => v * state.conversionRate
    const formatPrice = (v: number) => {
      const converted = convert(v)
      let formatted: string
      try {
        formatted = new Intl.NumberFormat(state.locale, {
          style: 'currency',
          currency: state.currency,
          minimumFractionDigits: state.decimals,
          maximumFractionDigits: state.decimals,
        }).format(converted)
      } catch {
        formatted = `$${Math.round(converted).toLocaleString('es-CO')}`
      }
      // Si showCurrencyCode está activo, agregar el código de moneda
      if (showCurrencyCode) {
        formatted = currencyPosition === 'right'
          ? `${formatted} ${state.currency}`
          : `${state.currency} ${formatted}`
      }
      return formatted
    }
    return { ...state, setCurrency, convert, formatPrice }
  }, [state, setCurrency, showCurrencyCode, currencyPosition])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

/**
 * Componente para mostrar un precio convertido a la moneda del visitante.
 * Uso: <Price value={12000} /> (value en moneda base de la organización)
 */
export function Price({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const { formatPrice } = useCurrency()
  return <span className={className} style={style}>{formatPrice(value)}</span>
}
