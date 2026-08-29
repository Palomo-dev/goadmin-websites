'use client'

import { useState, useEffect, useRef } from 'react'
import { countryCodeToFlag } from '@/lib/utils/countryFlag'

interface PhoneCountryInputProps {
  value: string // número completo ej: "+57 300 123 4567"
  onChange: (value: string) => void
  countryCode: string // código ISO del país seleccionado ej: "COL"
  primaryColor: string
}

interface Country {
  code: string
  name: string
  phone_code?: string
}

const selectClass = 'w-28 rounded-l-md border border-r-0 border-gray-300 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'
const inputClass = 'flex-1 rounded-r-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-offset-1'

/**
 * Extrae el prefijo internacional y el número de un valor combinado.
 * Ej: "+57 300 123 4567" → { prefix: "+57", number: "300 123 4567" }
 *     "+1 555 1234567"  → { prefix: "+1",  number: "555 1234567" }
 */
function splitPhoneValue(value: string): { prefix: string; number: string } {
  if (!value) return { prefix: '', number: '' }
  const match = value.match(/^(\+\d{1,4})\s?(.*)$/)
  if (match) {
    return { prefix: match[1], number: match[2] || '' }
  }
  // Si no tiene prefijo, todo es número
  return { prefix: '', number: value }
}

export function PhoneCountryInput({
  value,
  onChange,
  countryCode,
  primaryColor,
}: PhoneCountryInputProps) {
  const [countries, setCountries] = useState<Country[]>([])
  const [selectedPrefix, setSelectedPrefix] = useState<string>('')
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const initialized = useRef(false)

  const focusRing = { '--tw-ring-color': primaryColor } as React.CSSProperties

  // --- Fetch países al montar ---
  useEffect(() => {
    let cancelled = false
    const fetchCountries = async () => {
      try {
        const res = await fetch('/api/locations/countries')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (Array.isArray(data)) {
          setCountries(data.filter((c: Country) => c.phone_code))
        }
      } catch (err) {
        console.error('[PhoneCountryInput] Error fetching countries:', err)
      }
    }
    fetchCountries()
    return () => { cancelled = true }
  }, [])

  // --- Inicializar prefijo y número desde el value prop ---
  useEffect(() => {
    if (initialized.current) return
    const { prefix, number } = splitPhoneValue(value)
    setPhoneNumber(number)
    if (prefix) {
      setSelectedPrefix(prefix)
      initialized.current = true
    }
  }, [value])

  // --- Auto-seleccionar prefijo basado en countryCode cuando llega la lista ---
  useEffect(() => {
    if (selectedPrefix) return // ya hay prefijo elegido
    if (!countryCode || countries.length === 0) return
    const country = countries.find(c => c.code === countryCode)
    if (country?.phone_code) {
      const newPrefix = country.phone_code.startsWith('+') ? country.phone_code : `+${country.phone_code}`
      setSelectedPrefix(newPrefix)
      // Emitir el valor combinado si hay número
      if (phoneNumber) {
        onChange(`${newPrefix} ${phoneNumber}`)
      }
    }
  }, [countryCode, countries, selectedPrefix, phoneNumber, onChange])

  // --- Handler: cambiar prefijo ---
  const handlePrefixChange = (newPrefix: string) => {
    setSelectedPrefix(newPrefix)
    if (newPrefix && phoneNumber) {
      onChange(`${newPrefix} ${phoneNumber}`)
    } else if (newPrefix && !phoneNumber) {
      onChange(newPrefix)
    } else if (!newPrefix) {
      onChange(phoneNumber)
    }
  }

  // --- Handler: cambiar número ---
  const handleNumberChange = (newNumber: string) => {
    setPhoneNumber(newNumber)
    if (selectedPrefix && newNumber) {
      onChange(`${selectedPrefix} ${newNumber}`)
    } else if (selectedPrefix && !newNumber) {
      onChange(selectedPrefix)
    } else {
      onChange(newNumber)
    }
  }

  return (
    <div className="flex">
      <select
        value={selectedPrefix}
        onChange={(e) => handlePrefixChange(e.target.value)}
        className={selectClass}
        style={focusRing}
        aria-label="Prefijo telefónico"
      >
        <option value="">+--</option>
        {countries.map((c) => {
          const pc = c.phone_code || ''
          const prefix = pc.startsWith('+') ? pc : `+${pc}`
          return (
            <option key={c.code} value={prefix}>
              {countryCodeToFlag(c.code)} {prefix}
            </option>
          )
        })}
      </select>
      <input
        type="tel"
        value={phoneNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder="300 123 4567"
        className={inputClass}
        style={focusRing}
        autoComplete="off"
        aria-label="Número de teléfono"
      />
    </div>
  )
}

export default PhoneCountryInput
