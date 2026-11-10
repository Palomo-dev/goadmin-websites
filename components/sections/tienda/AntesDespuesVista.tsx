'use client'

/**
 * Comparador de `transformation · slider` (ver `AntesDespues.tsx`).
 *
 * El divisor es un `input type=range` nativo (teclado y lectores de pantalla sin código propio:
 * flechas = 1 %, RePág/AvPág = 10 %, Inicio/Fin). El dedo o el mouse lo mueven desde cualquier
 * punto de la foto (puntero capturado; el desplazamiento vertical de la página sigue libre con
 * `touch-action: pan-y`). El círculo visible solo sigue el valor y muestra el foco.
 */

import { useId, useRef, useState, type PointerEvent } from 'react'
import { ChevronsLeftRight } from 'lucide-react'
import type { ParAntesDespues } from '@/lib/website/v2/contrato/seccionesTienda'
import { ETIQUETAS_ANTES_DESPUES_POR_DEFECTO, type EtiquetasAntesDespues } from '@/lib/website/opcionesEditorTienda'

interface AntesDespuesVistaProps {
  items: ParAntesDespues[]
  /** Posición inicial del divisor (0–100). */
  inicio: number
  manija: { fondo: string; icono: string }
  /** Rótulos de las dos fotos (`before_label` / `after_label`); por defecto «Antes» y «Después». */
  etiquetas?: EtiquetasAntesDespues
}

export function AntesDespuesVista({ items, inicio, manija, etiquetas = ETIQUETAS_ANTES_DESPUES_POR_DEFECTO }: AntesDespuesVistaProps) {
  const { antes, despues } = etiquetas
  const [actual, setActual] = useState(0)
  const [valor, setValor] = useState(inicio)
  const [foco, setFoco] = useState(false)
  const idEtiqueta = useId()
  const arrastrando = useRef(false)
  const par = items[Math.min(actual, items.length - 1)]
  const nombre = par.name || (items.length > 1 ? `Caso ${actual + 1}` : '')

  const desdePuntero = (e: PointerEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.getBoundingClientRect()
    if (caja.width <= 0) return
    setValor(Math.round(Math.min(100, Math.max(0, ((e.clientX - caja.left) / caja.width) * 100))))
  }

  const elegir = (i: number) => {
    setActual(i)
    setValor(inicio)
  }

  return (
    <div>
      {items.length > 1 && (
        <div className="mb-5 flex flex-wrap justify-center gap-2" role="group" aria-label="Elige qué comparar">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === actual}
              onClick={() => elegir(i)}
              className={`min-h-[36px] rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                i === actual ? 'border-current font-medium' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {it.name || `Caso ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <div className="grid items-center gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-8">
        <span className="hidden text-2xl uppercase tracking-wide md:block" style={{ fontFamily: 'var(--font-heading, inherit)' }} aria-hidden="true">
          {antes}
        </span>
        <div
          className="relative mx-auto aspect-[4/3] w-full max-w-3xl cursor-ew-resize select-none overflow-hidden bg-black/5"
          style={{ borderRadius: 'min(var(--radio-sitio, 16px), 24px)', touchAction: 'pan-y' }}
          onPointerDown={(e) => {
            arrastrando.current = true
            e.currentTarget.setPointerCapture?.(e.pointerId)
            desdePuntero(e)
          }}
          onPointerMove={(e) => {
            if (arrastrando.current) desdePuntero(e)
          }}
          onPointerUp={() => {
            arrastrando.current = false
          }}
          onPointerCancel={() => {
            arrastrando.current = false
          }}
        >
          <img src={par.afterUrl} alt={nombre ? `${despues}: ${nombre}` : despues} className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false} />
          <img
            src={par.beforeUrl}
            alt={nombre ? `${antes}: ${nombre}` : antes}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - valor}% 0 0)` }}
            loading="lazy"
            draggable={false}
          />
          <span className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs uppercase tracking-wide text-white md:hidden" aria-hidden="true">
            {antes}
          </span>
          <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-xs uppercase tracking-wide text-white md:hidden" aria-hidden="true">
            {despues}
          </span>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90" style={{ left: `${valor}%` }} aria-hidden="true" />
          <div
            className={`pointer-events-none absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md ${foco ? 'ring-2 ring-white ring-offset-2 ring-offset-black/60' : ''}`}
            style={{ left: `${valor}%`, backgroundColor: manija.fondo, color: manija.icono }}
            aria-hidden="true"
          >
            <ChevronsLeftRight className="h-5 w-5" />
          </div>
          <span id={idEtiqueta} className="sr-only">
            {nombre ? `Comparar antes y después: ${nombre}` : 'Comparar antes y después'}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
            onFocus={() => setFoco(true)}
            onBlur={() => setFoco(false)}
            aria-labelledby={idEtiqueta}
            aria-valuetext={`${valor} % ${antes.toLocaleLowerCase('es')}, ${100 - valor} % ${despues.toLocaleLowerCase('es')}`}
            className="pointer-events-none absolute inset-0 h-full w-full appearance-none opacity-0"
          />
        </div>
        <span className="hidden text-2xl uppercase tracking-wide md:block" style={{ fontFamily: 'var(--font-heading, inherit)' }} aria-hidden="true">
          {despues}
        </span>
      </div>
    </div>
  )
}
