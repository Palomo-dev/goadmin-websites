'use client'

import { useState, useEffect, useCallback, useRef, useId } from 'react'
import { countryCodeToFlag } from '@/lib/utils/countryFlag'

interface LocationCheckoutFieldsProps {
  countryCode: string
  stateCode: string
  stateName: string
  city: string
  onChange: (data: { countryCode: string; stateCode: string; stateName: string; city: string }) => void
  primaryColor: string
  fallbackCities?: string[]
}

interface Country {
  code: string
  name: string
  phone_code?: string
}

interface StateOption {
  state_code: string
  state_name: string
}

interface CityOption {
  id: string
  code: string
  name: string
}

const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
const selectBaseClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'
const inputBaseClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-offset-1'

export function LocationCheckoutFields({
  countryCode,
  stateCode,
  stateName,
  city,
  onChange,
  primaryColor,
  fallbackCities = [],
}: LocationCheckoutFieldsProps) {
  const [countries, setCountries] = useState<Country[]>([])
  const reactId = useId()
  const countryId = `${reactId}-country`
  const stateId = `${reactId}-state`
  const cityId = `${reactId}-city`
  const [states, setStates] = useState<StateOption[]>([])
  const [cities, setCities] = useState<CityOption[]>([])
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [loadingStates, setLoadingStates] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)
  const [statesFetchedFor, setStatesFetchedFor] = useState<string>('')
  const [citiesFetchedFor, setCitiesFetchedFor] = useState<string>('')

  // Ref para evitar auto-detección múltiple
  const autoDetectRan = useRef(false)

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
          setCountries(data)
        }
      } catch (err) {
        console.error('[LocationCheckoutFields] Error fetching countries:', err)
      } finally {
        if (!cancelled) setLoadingCountries(false)
      }
    }
    fetchCountries()
    return () => { cancelled = true }
  }, [])

  // --- Auto-detección de país al montar (si no hay país seleccionado) ---
  useEffect(() => {
    if (autoDetectRan.current) return
    if (countryCode) {
      autoDetectRan.current = true
      return
    }
    autoDetectRan.current = true
    let cancelled = false
    const detectCountry = async () => {
      try {
        const res = await fetch('/api/locations/detect')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data?.country_code) {
          onChange({
            countryCode: data.country_code,
            stateCode: '',
            stateName: '',
            city: '',
          })
        }
      } catch (err) {
        console.error('[LocationCheckoutFields] Error detecting country:', err)
      }
    }
    detectCountry()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Fetch estados cuando cambia el país ---
  const fetchStates = useCallback(async (cc: string) => {
    if (!cc) {
      setStates([])
      setStatesFetchedFor('')
      return
    }
    if (statesFetchedFor === cc) return
    setLoadingStates(true)
    try {
      const res = await fetch(`/api/locations/states?country_code=${encodeURIComponent(cc)}`)
      if (!res.ok) {
        setStates([])
        setStatesFetchedFor(cc)
        return
      }
      const data = await res.json()
      setStates(Array.isArray(data) ? data : [])
      setStatesFetchedFor(cc)
    } catch (err) {
      console.error('[LocationCheckoutFields] Error fetching states:', err)
      setStates([])
      setStatesFetchedFor(cc)
    } finally {
      setLoadingStates(false)
    }
  }, [statesFetchedFor])

  useEffect(() => {
    if (countryCode) {
      fetchStates(countryCode)
    } else {
      setStates([])
      setStatesFetchedFor('')
    }
  }, [countryCode, fetchStates])

  // --- Fetch ciudades cuando cambia el estado ---
  const fetchCities = useCallback(async (cc: string, sc: string) => {
    if (!cc || !sc) {
      setCities([])
      setCitiesFetchedFor('')
      return
    }
    const key = `${cc}|${sc}`
    if (citiesFetchedFor === key) return
    setLoadingCities(true)
    try {
      const res = await fetch(`/api/locations/cities?country_code=${encodeURIComponent(cc)}&state_code=${encodeURIComponent(sc)}`)
      if (!res.ok) {
        setCities([])
        setCitiesFetchedFor(key)
        return
      }
      const data = await res.json()
      setCities(Array.isArray(data) ? data : [])
      setCitiesFetchedFor(key)
    } catch (err) {
      console.error('[LocationCheckoutFields] Error fetching cities:', err)
      setCities([])
      setCitiesFetchedFor(key)
    } finally {
      setLoadingCities(false)
    }
  }, [citiesFetchedFor])

  useEffect(() => {
    if (countryCode && stateCode) {
      fetchCities(countryCode, stateCode)
    } else {
      setCities([])
      setCitiesFetchedFor('')
    }
  }, [countryCode, stateCode, fetchCities])

  // --- Handlers ---
  const handleCountryChange = (newCountryCode: string) => {
    setStates([])
    setCities([])
    setStatesFetchedFor('')
    setCitiesFetchedFor('')
    onChange({
      countryCode: newCountryCode,
      stateCode: '',
      stateName: '',
      city: '',
    })
  }

  const handleStateSelect = (newStateCode: string) => {
    const state = states.find(s => s.state_code === newStateCode)
    setCities([])
    setCitiesFetchedFor('')
    onChange({
      countryCode,
      stateCode: newStateCode,
      stateName: state?.state_name || '',
      city: '',
    })
  }

  const handleStateText = (text: string) => {
    onChange({
      countryCode,
      stateCode: '',
      stateName: text,
      city,
    })
  }

  const handleCityChange = (text: string) => {
    onChange({
      countryCode,
      stateCode,
      stateName,
      city: text,
    })
  }

  const hasStatesData = states.length > 0
  const focusRing = { '--tw-ring-color': primaryColor } as React.CSSProperties

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* País */}
      <div>
        <label htmlFor={countryId} className={labelClass}>País</label>
        <select
          id={countryId}
          value={countryCode}
          onChange={(e) => handleCountryChange(e.target.value)}
          disabled={loadingCountries}
          className={selectBaseClass}
          style={focusRing}
        >
          <option value="">
            {loadingCountries ? 'Cargando países...' : 'Seleccionar país...'}
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {countryCodeToFlag(c.code)} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Estado / Departamento */}
      <div>
        <label htmlFor={stateId} className={labelClass}>Estado / Departamento</label>
        {hasStatesData ? (
          <select
            id={stateId}
            value={stateCode}
            onChange={(e) => handleStateSelect(e.target.value)}
            disabled={loadingStates}
            className={selectBaseClass}
            style={focusRing}
          >
            <option value="">
              {loadingStates ? 'Cargando...' : 'Seleccionar...'}
            </option>
            {states.map((s) => (
              <option key={s.state_code} value={s.state_code}>
                {s.state_name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={stateId}
            type="text"
            value={stateName}
            onChange={(e) => handleStateText(e.target.value)}
            placeholder="Escribe tu estado o provincia"
            disabled={loadingStates}
            className={inputBaseClass}
            style={focusRing}
          />
        )}
      </div>

      {/* Ciudad / Municipio */}
      <div>
        <label htmlFor={cityId} className={labelClass}>Ciudad / Municipio</label>
        <input
          id={cityId}
          type="text"
          list={`${reactId}-cities`}
          value={city}
          onChange={(e) => handleCityChange(e.target.value)}
          placeholder="Escribe o selecciona tu ciudad..."
          autoComplete="off"
          disabled={loadingCities && !city}
          className={inputBaseClass}
          style={focusRing}
        />
        <datalist id={`${reactId}-cities`}>
          {cities.map((c) => (
            <option key={c.id || c.code} value={c.name} />
          ))}
          {fallbackCities
            .filter(fc => !cities.some(c => c.name === fc))
            .map(fc => (
              <option key={`fallback-${fc}`} value={fc} />
            ))}
        </datalist>
      </div>
    </div>
  )
}

export default LocationCheckoutFields
