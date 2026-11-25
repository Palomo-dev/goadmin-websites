'use client'

/**
 * «Ciudad o municipio» del checkout v2 (Figma «16 Sitio web» › Checkout v2, A1b y pieza 3138-92609):
 * un solo campo con la lista oficial y buscador. Escribe y elige; el municipio elegido llena ciudad,
 * departamento y su código (los mismos campos que hoy llenaba el trío País / Departamento / Ciudad,
 * con los que cotizan /api/shipping/quote, /api/shipping/calculate y la contraentrega).
 *
 * `else` con lo de hoy: si el país no tiene catálogo (fuera de Colombia) o el cliente toca «Cambiar
 * país», se pinta `LocationCheckoutFields` tal cual. Lo escrito a mano sin elegir de la lista se
 * conserva como ciudad (como el campo libre de hoy).
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import LocationCheckoutFields from '@/components/site/LocationCheckoutFields'
import { buscarMunicipios, crearCargadorUbicacion, etiquetaMunicipio, municipioExacto, paisParaLista, type Municipio } from './municipios'

export interface ValorUbicacion {
  countryCode: string
  stateCode: string
  stateName: string
  city: string
}

/**
 * Un solo cargador por página (municipios.ts): el país del visitante se pregunta una vez y la lista
 * de cada país se pide una vez, aunque el campo se monte varias veces (modo estricto de React,
 * tarjetas que se pliegan, cambio de entrega). Sus promesas siempre terminan (país por defecto o
 * lista vacía), así que el campo nunca se queda en «Cargando».
 */
const cargador = crearCargadorUbicacion((url) => fetch(url))
/** Red de seguridad: si por cualquier motivo la lista no llega, pasa a los campos de siempre. */
const ESPERA_MAXIMA_MS = 12_000

export function MunicipioBuscador({
  id,
  valor,
  onCambio,
  color,
  error,
  ayuda,
  placeholder,
  fallbackCities,
}: {
  /** Id del campo (el resumen de errores lleva aquí). */
  id: string
  valor: ValorUbicacion
  onCambio: (v: ValorUbicacion) => void
  color: string
  error: string | null
  ayuda?: string | null
  /** Texto de ejemplo del ERP (Parte F). Sin él, el de siempre. */
  placeholder?: string
  fallbackCities?: string[]
}) {
  const listaId = useId()
  const [lista, setLista] = useState<Municipio[] | null>(null)
  const [paisManual, setPaisManual] = useState(false)
  const [texto, setTexto] = useState(valor.city)
  const [abierta, setAbierta] = useState(false)
  const [activo, setActivo] = useState(0)
  // Lo último que llegó de fuera: la detección del país no pisa una ciudad que ya estaba guardada.
  const ultimo = useRef(valor)
  ultimo.current = valor
  const pais = valor.countryCode
  const paisLista = paisParaLista(pais)

  // Sin país: el del visitante (una sola consulta por página) o Colombia si no se detecta (en
  // localhost /api/locations/detect responde null). No se descarta la respuesta al desmontar: solo
  // se aplica si el país sigue vacío.
  useEffect(() => {
    if (pais) return
    cargador.pais().then((c) => {
      if (!ultimo.current.countryCode) onCambio({ ...ultimo.current, countryCode: c })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pais])

  // La lista del país (nunca sin país). País sin forma de código: los campos de siempre.
  useEffect(() => {
    if (!paisLista) {
      setLista(pais ? [] : null)
      return
    }
    let vivo = true
    setLista(null)
    cargador.municipios(paisLista).then((l) => {
      if (vivo) setLista(l)
    })
    // Red de seguridad: nunca «Cargando» para siempre.
    const t = setTimeout(() => {
      if (vivo) setLista((actual) => actual ?? [])
    }, ESPERA_MAXIMA_MS)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [paisLista, pais])

  // Mientras se detecta el país (sin país todavía), la misma red de seguridad.
  useEffect(() => {
    if (pais || lista !== null) return
    const t = setTimeout(() => setLista((actual) => actual ?? []), ESPERA_MAXIMA_MS)
    return () => clearTimeout(t)
  }, [pais, lista])

  // Lo que llega de fuera (dirección guardada, datos del navegador) se refleja en el campo.
  useEffect(() => {
    setTexto(valor.city)
  }, [valor.city])

  // Ciudad guardada sin departamento («Medellín» de antes): se reconoce en la lista una sola vez.
  useEffect(() => {
    if (!lista || lista.length === 0 || !valor.city || valor.stateCode) return
    const m = municipioExacto(lista, valor.city, null)
    if (m) onCambio({ countryCode: pais, stateCode: m.state_code, stateName: m.state_name, city: m.name })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista])

  const opciones = useMemo(() => (lista ? buscarMunicipios(lista, texto === valor.city && valor.stateCode ? '' : texto, 8) : []), [lista, texto, valor.city, valor.stateCode])

  // País sin catálogo, o «Cambiar país»: los campos de siempre.
  if (paisManual || (lista !== null && lista.length === 0)) {
    return (
      <div id={id} tabIndex={-1}>
        <LocationCheckoutFields
          countryCode={valor.countryCode}
          stateCode={valor.stateCode}
          stateName={valor.stateName}
          city={valor.city}
          onChange={onCambio}
          primaryColor={color}
          fallbackCities={fallbackCities}
        />
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    )
  }

  const elegir = (m: Municipio) => {
    onCambio({ countryCode: pais || paisLista || 'COL', stateCode: m.state_code, stateName: m.state_name, city: m.name })
    setTexto(m.name)
    setAbierta(false)
  }

  const alSalir = () => {
    setTimeout(() => setAbierta(false), 120)
    if (texto === valor.city) return
    // Lista aún sin llegar: lo escrito vale como ciudad (texto libre, como hoy).
    const m = lista ? municipioExacto(lista, texto, null) : null
    if (m) elegir(m)
    else onCambio({ countryCode: pais, stateCode: '', stateName: '', city: texto.trim() })
  }

  const conError = !!error
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierta && opciones.length > 0}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={abierta && opciones[activo] ? `${listaId}-${activo}` : undefined}
          aria-invalid={conError ? true : undefined}
          aria-describedby={conError ? `${id}-error` : `${id}-ayuda`}
          autoComplete="address-level2"
          value={texto}
          placeholder={placeholder ?? (lista === null ? 'Escribe tu ciudad o municipio' : 'Escribe para buscar')}
          onFocus={() => setAbierta(true)}
          onChange={(e) => {
            setTexto(e.target.value)
            setActivo(0)
            setAbierta(true)
          }}
          onBlur={alSalir}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAbierta(true)
              setActivo((a) => Math.min(a + 1, Math.max(0, opciones.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActivo((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter' && abierta && opciones[activo]) {
              e.preventDefault()
              elegir(opciones[activo])
            } else if (e.key === 'Escape') {
              setAbierta(false)
            }
          }}
          className={`h-11 w-full rounded-lg border bg-white px-3 pr-9 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-offset-1 ${conError ? 'border-red-500' : 'border-gray-300'}`}
          style={{ ['--tw-ring-color' as string]: conError ? '#EF4444' : color }}
        />
        {lista === null ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        )}
        {abierta && opciones.length > 0 && (
          <ul id={listaId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {opciones.map((m, i) => (
              <li
                key={`${m.code}-${m.state_code}`}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === activo}
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(m)
                }}
                onMouseEnter={() => setActivo(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === activo ? 'bg-gray-100' : ''}`}
              >
                <span className="text-gray-900">{m.name}</span>
                {etiquetaMunicipio(m) !== m.name && <span className="text-gray-500"> · {m.state_name}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {conError ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-gray-500">
          {ayuda ?? 'Escribe para buscar; si no aparece, escríbela completa'}
          {' · '}
          <button type="button" onClick={() => setPaisManual(true)} className="underline underline-offset-2">
            Otro país
          </button>
        </p>
      )}
    </div>
  )
}
