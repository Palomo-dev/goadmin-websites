'use client'

/**
 * Flechas y puntos de los carruseles del sitio. Mismas piezas que ya usan los carruseles de
 * productos (`ProductsCarousel`: círculo blanco de 40 px con el chevrón en el color de la marca;
 * puntos en píldora de 8 px, el activo de 24 px en el color de la marca), ahora con nombre
 * accesible, `type="button"` y foco visible.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { botonFlecha, flechaPersonalizada, type AparienciaCarrusel, type EstiloPuntos } from '@/lib/carrusel/aparienciaCarrusel'
import { clasesFlecha, clasesPunto, posicionFlecha, type CarruselResuelto } from '@/lib/website/v2/paginacionCarrusel'

const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

export function FlechaCarrusel({
  direccion,
  onClick,
  color,
  disabled,
  etiqueta,
  className = '',
  apariencia,
}: {
  direccion: 'anterior' | 'siguiente'
  onClick: () => void
  color?: string
  disabled?: boolean
  /** Nombre accesible; por defecto «Anterior» / «Siguiente». */
  etiqueta?: string
  className?: string
  /** Estilo, tamaño y colores elegidos en el editor; sin claves se ve como siempre. */
  apariencia?: AparienciaCarrusel
}) {
  const Icono = direccion === 'anterior' ? ChevronLeft : ChevronRight
  if (flechaPersonalizada(apariencia)) {
    const b = botonFlecha(apariencia!, color)
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={etiqueta ?? (direccion === 'anterior' ? 'Anterior' : 'Siguiente')}
        className={`${b.className} transition-transform hover:scale-110 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed ${FOCO} ${className}`}
        style={b.style}
        data-flecha-estilo={apariencia!.estiloFlecha ?? 'circle'}
      >
        <Icono style={{ width: b.icono, height: b.icono }} aria-hidden="true" />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta ?? (direccion === 'anterior' ? 'Anterior' : 'Siguiente')}
      className={`w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed ${FOCO} ${className}`}
      style={{ color }}
    >
      <Icono className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}

export function PuntosCarrusel({
  total,
  actual,
  onSelect,
  color,
  etiqueta = (i) => `Ir a la diapositiva ${i + 1}`,
  className = '',
  estilo,
}: {
  total: number
  actual: number
  onSelect: (i: number) => void
  color?: string
  etiqueta?: (i: number) => string
  className?: string
  /** «Puntos» (hoy), «Barras» o «Números»; sin clave, como siempre. */
  estilo?: EstiloPuntos
}) {
  if (total <= 1) return null
  if (estilo === 'bars' || estilo === 'numbers') {
    return (
      <div className={`flex justify-center items-center gap-1.5 ${className}`} data-carrusel-puntos={estilo}>
        {Array.from({ length: total }).map((_, i) => {
          const activo = i === actual
          return estilo === 'bars' ? (
            <button key={i} type="button" onClick={() => onSelect(i)} aria-label={etiqueta(i)} aria-current={activo ? 'true' : undefined}
              className={`h-1 w-8 rounded-sm transition-all ${FOCO} ${activo ? '' : 'bg-gray-300 dark:bg-gray-600'}`}
              style={activo ? { backgroundColor: color ?? '#111827' } : {}} />
          ) : (
            <button key={i} type="button" onClick={() => onSelect(i)} aria-label={etiqueta(i)} aria-current={activo ? 'true' : undefined}
              className={`min-w-6 h-6 px-1 rounded text-xs font-medium transition-all ${FOCO} ${activo ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
              style={activo ? { backgroundColor: color ?? '#111827' } : {}}>{i + 1}</button>
          )
        })}
      </div>
    )
  }
  return (
    <div className={`flex justify-center gap-1.5 ${className}`} data-carrusel-puntos="">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={etiqueta(i)}
          aria-current={i === actual ? 'true' : undefined}
          className={`rounded-full transition-all ${FOCO} ${i === actual ? 'w-6 h-2' : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'}`}
          style={i === actual ? { backgroundColor: color } : {}}
        />
      ))}
    </div>
  )
}

export function ControlesCarrusel({
  resuelta,
  total,
  actual,
  color,
  onAnterior,
  onSiguiente,
  onIr,
  deshabilitarAnterior,
  deshabilitarSiguiente,
  miniaturas,
  forzar,
}: {
  /** null: las flechas y los puntos de siempre del carrusel de productos. */
  resuelta: CarruselResuelto | null
  total: number
  actual: number
  color?: string
  onAnterior: () => void
  onSiguiente: () => void
  onIr: (i: number) => void
  deshabilitarAnterior?: boolean
  deshabilitarSiguiente?: boolean
  miniaturas?: { src: string; alt: string }[]
  /** Muestra los controles aunque `activo` sea false (el carrusel de productos). */
  forzar?: boolean
}) {
  if (total <= 1) return null
  if (resuelta && !resuelta.activo && !forzar) return null
  const r = resuelta
  const indicador = r?.activo ? r.indicador : 'puntos'
  const estilo = r?.activo ? r.estiloFlechas : 'hover'
  const pos = r?.activo ? r.posicionFlechas : 'lados_dentro'
  const tamano = r?.activo ? r.tamanoFlecha : 'md'
  const sombra = r?.activo ? r.sombraFlecha : true
  const mostrarFlechas = r ? r.flechas : true
  const colorIcono = r?.colorIcono || color
  const alinear = r?.alineacionIndicador === 'izq' ? 'justify-start' : r?.alineacionIndicador === 'der' ? 'justify-end' : 'justify-center'
  const dentro = r?.posicionIndicador === 'abajo_dentro'
  const teclado = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onAnterior()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onSiguiente()
    }
  }
  const flecha = (direccion: 'anterior' | 'siguiente') => {
    if (!mostrarFlechas) return null
    const deshabilitado = direccion === 'anterior' ? deshabilitarAnterior : deshabilitarSiguiente
    const clasePos = pos === 'titulo' || pos === 'indicador' ? '' : posicionFlecha(pos, direccion)
    return (
      <button
        type="button"
        onClick={direccion === 'anterior' ? onAnterior : onSiguiente}
        disabled={deshabilitado}
        aria-label={direccion === 'anterior' ? 'Anterior' : 'Siguiente'}
        className={`${clasesFlecha(estilo, tamano, sombra)} ${clasePos} disabled:opacity-40 disabled:cursor-not-allowed`}
        style={{
          color: colorIcono,
          ...(r?.activo && r.tamanoFlechaPx ? { width: r.tamanoFlechaPx, height: r.tamanoFlechaPx } : {}),
          backgroundColor: r?.activo && r.fondoFlecha && estilo !== 'chevron' ? r.fondoFlecha : undefined,
          borderColor: r?.bordeFlecha,
        }}
      >
        {estilo === 'larga'
          ? <span aria-hidden="true">{direccion === 'anterior' ? '←' : '→'}</span>
          : (direccion === 'anterior' ? <ChevronLeft className="h-5 w-5" aria-hidden="true" /> : <ChevronRight className="h-5 w-5" aria-hidden="true" />)}
      </button>
    )
  }
  const puntos = indicador === 'ninguno' ? null : indicador === 'numeros' ? (
    <p className={`text-sm tabular-nums text-gray-600 dark:text-gray-300 ${alinear} flex`} aria-live="polite">{actual + 1}/{total}</p>
  ) : indicador === 'progreso' ? (
    <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuenow={actual + 1} aria-valuemin={1} aria-valuemax={total} aria-label="Progreso del carrusel">
      <div className="h-full rounded-full" style={{ width: `${((actual + 1) / total) * 100}%`, backgroundColor: r?.colorActivo || color }} />
    </div>
  ) : indicador === 'miniaturas' && miniaturas && miniaturas.length > 0 ? (
    <div className={`flex gap-2 overflow-x-auto ${alinear}`} role="tablist" aria-label="Miniaturas">
      {miniaturas.map((m, i) => (
        <button key={m.src + i} type="button" role="tab" aria-selected={i === actual} aria-label={m.alt || `Ir a la diapositiva ${i + 1}`} onClick={() => onIr(i)} className={`h-12 w-16 shrink-0 overflow-hidden rounded border ${i === actual ? 'ring-2' : 'opacity-70'} ${FOCO}`} style={{ borderColor: i === actual ? (r?.colorActivo || color) : undefined }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.src} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  ) : (
    <div className={`flex gap-1.5 ${alinear} ${dentro ? '' : 'mt-3'}`} data-carrusel-puntos="">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onIr(i)}
          aria-label={`Ir a la diapositiva ${i + 1}`}
          aria-current={i === actual ? 'true' : undefined}
          className={`${clasesPunto(i === actual, r?.tamanoIndicador ?? 'md', indicador === 'barra' ? 'barra' : 'puntos')} ${FOCO}`}
          style={i === actual ? { backgroundColor: r?.colorActivo || color } : r?.colorInactivo ? { backgroundColor: r.colorInactivo } : {}}
        />
      ))}
    </div>
  )
  const junto = pos === 'titulo' || pos === 'indicador'
  return (
    <div className={dentro ? 'pointer-events-none absolute inset-x-0 bottom-3 z-20 px-3 [&_button]:pointer-events-auto' : ''} onKeyDown={teclado}>
      {junto && pos === 'titulo' ? null : (
        <>
          {flecha('anterior')}
          {flecha('siguiente')}
        </>
      )}
      {junto ? (
        <div className={`flex items-center gap-2 ${alinear}`}>
          {pos === 'indicador' && flecha('anterior')}
          {puntos}
          {pos === 'indicador' && flecha('siguiente')}
        </div>
      ) : puntos}
    </div>
  )
}

