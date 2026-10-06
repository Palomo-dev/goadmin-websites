'use client'

/**
 * Teléfono con país del sitio público: bandera, indicativo (+57, +1…),
 * formato del país mientras se escribe, validación por país y salida en
 * E.164 («+573001234567»).
 *
 * La lógica es la del ERP (`PhoneInput` del kit): `lib/utils/telefono.ts` y
 * `lib/data/countryPhoneCodes.ts` son COPIAS idénticas (`npm run verify:copias`).
 * Aquí solo cambia la presentación: el país se elige con un `<select>` nativo
 * (accesible y cómodo en el celular) superpuesto a la bandera SVG, para no
 * depender de los emoji de bandera, que en Windows salen como letras.
 *
 * `onChange` recibe '' si el campo está vacío y, si no, el número en E.164
 * cuando es válido o el valor de almacenamiento («+57 300123») mientras está
 * incompleto: el formulario decide con `telefonoValido`/`errorTelefono`.
 */

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { getCountryByIso, type CountryPhoneCode } from '@/lib/data/countryPhoneCodes'
import {
  DEFAULT_COUNTRY_ISO,
  aE164,
  ejemploNacional,
  esTelefonoValido,
  excedeLongitud,
  formatearNacional,
  formatearParaGuardar,
  indicativoDe,
  mensajeErrorTelefono,
  paisesTelefono,
  parsearTelefono,
} from '@/lib/utils/telefono'

export { esTelefonoValido as telefonoValido, mensajeErrorTelefono as errorTelefono, aE164 }

type Banderas = Record<string, ((p: { className?: string; 'aria-hidden'?: boolean }) => JSX.Element) | undefined>
let banderas: Banderas | null = null
let cargando: Promise<Banderas> | null = null

function useBanderas(): Banderas | null {
  const [mod, setMod] = useState<Banderas | null>(banderas)
  useEffect(() => {
    if (mod) return
    let vivo = true
    cargando ??= import('country-flag-icons/react/3x2').then((m) => (banderas = m as unknown as Banderas))
    cargando.then((m) => vivo && setMod(m)).catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [mod])
  return mod
}

function Bandera({ iso }: { iso: string }) {
  const mod = useBanderas()
  const Svg = mod?.[iso]
  const base = 'inline-block h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10'
  if (!Svg) return <span aria-hidden="true" className={`${base} bg-gray-100 text-center text-[9px] font-semibold leading-[14px] text-gray-500`}>{iso}</span>
  return <Svg aria-hidden className={base} />
}

/** E.164 si es válido; si no, el valor tal cual (incompleto) o ''. */
function salida(valor: string, iso: string): string {
  if (!valor) return ''
  return aE164(valor, iso) ?? valor
}

export interface TelefonoPaisProps {
  value: string
  onChange: (valor: string) => void
  /** País por defecto (alfa-2). Sin él, Colombia. */
  paisPorDefecto?: string
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  /** Clases del contenedor (borde, radio, fondo): las del resto del formulario. */
  className?: string
  /** Estilo del contenedor (p. ej. el color de foco de la marca). */
  style?: CSSProperties
  /** Mostrar el mensaje de validación al salir del campo. */
  mostrarError?: boolean
  'aria-label'?: string
}

export function TelefonoPais({
  value,
  onChange,
  paisPorDefecto,
  id,
  name,
  required,
  disabled,
  placeholder,
  className = 'rounded-lg border border-gray-300 bg-white',
  style,
  mostrarError = true,
  'aria-label': ariaLabel,
}: TelefonoPaisProps) {
  const autoId = useId()
  const inputId = id ?? `tel-${autoId}`
  const errorId = `${inputId}-error`
  const isoDefecto = paisPorDefecto && getCountryByIso(paisPorDefecto) ? paisPorDefecto : DEFAULT_COUNTRY_ISO
  const [isoManual, setIsoManual] = useState<string | null>(null)
  const [tocado, setTocado] = useState(false)

  const parsed = useMemo(() => parsearTelefono(value, isoManual ?? isoDefecto), [value, isoManual, isoDefecto])
  const iso = parsed?.iso ?? isoManual ?? isoDefecto
  const pais: CountryPhoneCode = getCountryByIso(iso) ?? (getCountryByIso(DEFAULT_COUNTRY_ISO) as CountryPhoneCode)
  const numero = parsed?.number ?? ''
  const texto = formatearNacional(pais.iso, numero)
  const error = mostrarError && tocado && value ? mensajeErrorTelefono(value, isoDefecto) : null

  const elegirPais = (nuevo: string) => {
    setIsoManual(nuevo)
    onChange(salida(formatearParaGuardar(nuevo, numero), nuevo))
  }

  const alEscribir = (crudo: string) => {
    // Pegar un número internacional completo cambia de país.
    if (/^\s*(\+|00)/.test(crudo)) {
      const p = parsearTelefono(crudo, pais.iso)
      if (p) {
        setIsoManual(p.iso)
        onChange(salida(formatearParaGuardar(p.iso, p.number), p.iso))
        return
      }
    }
    let digitos = crudo.replace(/\D/g, '')
    // Borrar un separador se lleva el dígito anterior.
    if (crudo.length < texto.length && digitos === numero) digitos = digitos.slice(0, -1)
    if (digitos.length > numero.length && excedeLongitud(pais.iso, digitos)) return
    onChange(salida(formatearParaGuardar(pais.iso, digitos), pais.iso))
  }

  return (
    <div>
      <div
        className={`flex items-stretch focus-within:ring-2 focus-within:ring-offset-1 ${error ? 'border-red-500' : ''} ${className}`}
        style={style}
      >
        <div className="relative flex shrink-0 items-center gap-1.5 border-r border-inherit px-2.5 text-sm">
          <Bandera iso={pais.iso} />
          <span className="tabular-nums opacity-80">{indicativoDe(pais.iso) || pais.dialCode}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 opacity-60" fill="currentColor">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
          </svg>
          <select
            value={pais.iso}
            disabled={disabled}
            onChange={(e) => elegirPais(e.target.value)}
            aria-label={`País del teléfono: ${pais.name} (${pais.dialCode})`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          >
            {paisesTelefono.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name} ({c.dialCode})
              </option>
            ))}
          </select>
        </div>
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          onBlur={() => setTocado(true)}
          placeholder={placeholder ?? ejemploNacional(pais.iso)}
          required={required}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
      </div>
      {error && (
        <p id={errorId} role="status" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export default TelefonoPais
