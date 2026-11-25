'use client'

/**
 * Piezas de formulario del checkout v2 (Figma «16 Sitio web» › Checkout v2, A1 y C1; piezas E):
 * - `CampoCheckout`: etiqueta asociada (htmlFor), ayuda, error que dice qué hacer, `autoComplete` e
 *   `inputMode` correctos y check verde cuando el dato está bien.
 * - `CasillaCheckout`: casilla con título y línea pequeña.
 * - `ResumenErrores`: «Revisa 3 datos para continuar» con enlaces a cada campo.
 * - `TarjetaCheckout` y `TarjetaNumerada` (checkout de 1 paso: número o check, «Cambiar»).
 */

import { useId, type ReactNode } from 'react'
import { AlertCircle, Check, ChevronDown } from 'lucide-react'
import type { CampoCheckout as DefCampo } from './camposCheckout'
import { tituloResumenErrores, type ErrorCampo } from './reglasCheckout'

/** Id del elemento de un campo (lo usan el resumen de errores y «Cambiar dirección»). */
export function idCampo(clave: string): string {
  return `checkout-${clave}`
}

const BORDE = 'border-gray-300'

export function CampoCheckout({
  def,
  valor,
  onCambio,
  error,
  mostrarError,
  onSalir,
  color,
  obligatorio,
  ayuda,
  etiqueta,
  maxLength,
  mayusculas,
}: {
  def: DefCampo
  valor: string
  onCambio: (v: string) => void
  error: string | null
  /** El error se pinta después de salir del campo o de intentar seguir. */
  mostrarError: boolean
  onSalir?: () => void
  color: string
  obligatorio?: boolean
  ayuda?: string | null
  etiqueta?: string
  maxLength?: number
  mayusculas?: boolean
}) {
  const id = idCampo(def.clave)
  const conError = mostrarError && !!error
  const bien = mostrarError && !error && valor.trim().length > 0
  const textoAyuda = ayuda === undefined ? def.ayuda : ayuda
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {etiqueta ?? def.etiqueta}
        {(obligatorio ?? def.obligatorio) ? <span className="sr-only"> (obligatorio)</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          name={def.clave}
          type={def.tipo}
          inputMode={def.inputMode ?? undefined}
          autoComplete={def.autoComplete ?? 'off'}
          autoCapitalize={mayusculas ? 'characters' : def.tipo === 'email' ? 'none' : undefined}
          autoCorrect={def.tipo === 'email' || mayusculas ? 'off' : undefined}
          spellCheck={def.tipo === 'email' || mayusculas ? false : undefined}
          value={valor}
          maxLength={maxLength}
          onChange={(e) => onCambio(mayusculas ? e.target.value.toUpperCase() : e.target.value)}
          onBlur={onSalir}
          placeholder={def.placeholder ?? undefined}
          aria-invalid={conError ? true : undefined}
          aria-describedby={conError ? `${id}-error` : textoAyuda ? `${id}-ayuda` : undefined}
          className={`h-11 w-full rounded-lg border bg-white px-3 pr-9 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-offset-1 ${conError ? 'border-red-500' : BORDE}`}
          style={{ ['--tw-ring-color' as string]: conError ? '#EF4444' : color }}
        />
        {conError ? (
          <AlertCircle className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" aria-hidden="true" />
        ) : bien ? (
          <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" aria-hidden="true" />
        ) : null}
      </div>
      {conError ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>
      ) : textoAyuda ? (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-gray-500">{textoAyuda}</p>
      ) : null}
    </div>
  )
}

/** Error suelto bajo una pieza que no es un `<input>` simple (celular, municipio). */
export function ErrorDeCampo({ id, error }: { id: string; error: string | null }) {
  if (!error) return null
  return <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>
}

export function CasillaCheckout({
  id,
  marcada,
  onCambio,
  titulo,
  detalle,
  color,
}: {
  id: string
  marcada: boolean
  onCambio: (v: boolean) => void
  titulo: string
  detalle?: string | null
  color: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={marcada}
        onChange={(e) => onCambio(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300"
        style={{ accentColor: color }}
      />
      <span>
        <span className="block text-sm text-gray-900">{titulo}</span>
        {detalle ? <span className="block text-xs text-gray-500">{detalle}</span> : null}
      </span>
    </label>
  )
}

/** «Revisa N datos para continuar»: cada enlace lleva al campo. */
export function ResumenErrores({ errores }: { errores: readonly ErrorCampo[] }) {
  if (errores.length === 0) return null
  const ir = (campo: string) => {
    const el = document.getElementById(idCampo(campo))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(el as HTMLInputElement).focus?.({ preventScroll: true })
    }
  }
  return (
    <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4" data-resumen-errores="">
      <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {tituloResumenErrores(errores.length)}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-6">
        {errores.map((e) => (
          <li key={e.campo}>
            <button type="button" onClick={() => ir(e.campo)} className="text-xs font-medium text-red-700 underline underline-offset-2">
              {e.etiqueta}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tarjeta blanca de una sección (3 pasos). */
export function TarjetaCheckout({ titulo, children, className = '' }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 ${className}`}>
      {titulo ? <h2 className="mb-4 text-lg font-semibold text-gray-900">{titulo}</h2> : null}
      {children}
    </section>
  )
}

/**
 * Tarjeta numerada del checkout de 1 paso (Figma B): número (o check si la sección está completa),
 * título y una línea; tocar el encabezado la pliega o despliega, como hoy.
 */
export function TarjetaNumerada({
  numero,
  titulo,
  subtitulo,
  completa,
  abierta,
  onAlternar,
  color,
  children,
}: {
  numero: number
  titulo: string
  subtitulo?: string | null
  completa: boolean
  abierta: boolean
  onAlternar: () => void
  color: string
  children: ReactNode
}) {
  const idCuerpo = `tarjeta-${numero}-${useId().replace(/:/g, '')}`
  return (
    <section className="mb-6 rounded-2xl border bg-white" style={{ borderColor: abierta && !completa ? color : '#E5E7EB' }} data-tarjeta-numerada={numero}>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        className="flex w-full items-center gap-3 p-5 text-left sm:px-6"
      >
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={completa ? { backgroundColor: '#DCFCE7', color: '#15803D' } : { backgroundColor: color, color: '#fff' }}
        >
          {completa ? <Check className="h-4 w-4" aria-hidden="true" /> : numero}
          <span className="sr-only">{completa ? ' (completa)' : ''}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold text-gray-900">{titulo}</span>
          {subtitulo ? <span className="block truncate text-sm text-gray-500">{subtitulo}</span> : null}
        </span>
        <ChevronDown className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {abierta && (
        <div id={idCuerpo} className="px-5 pb-5 sm:px-6 sm:pb-6">
          {children}
        </div>
      )}
    </section>
  )
}
