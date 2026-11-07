'use client'

/**
 * Lista con foto activa de `product_index · list` (ver `IndiceProductos.tsx`).
 *
 * La fila activa cambia con el mouse (`onMouseEnter`) y con el foco del teclado (`onFocus`): no
 * hace falta hover para ver la foto. En el celular no hay panel lateral: cada fila lleva su
 * miniatura y toca para ir a la ficha. El panel de la foto repite la fila activa (mismo enlace),
 * así que va con `aria-hidden` y fuera del orden de tabulación: el lector y el teclado usan la lista.
 */

import { useState } from 'react'
import { Price } from '@/components/site/CurrencyProvider'

export interface FilaIndice {
  id: number
  nombre: string
  href: string
  precio: number | null
  foto: string | null
  /** «Sala · 70 × 90 × 85 cm» (categoría y medidas reales; vacío si no hay). */
  detalle: string
}

interface IndiceProductosVistaProps {
  titulo: string
  filas: FilaIndice[]
  cta: { texto: string; href: string } | null
  colorBoton: { fondo: string; texto: string }
}

const LINEA = 'color-mix(in srgb, currentColor 15%, transparent)'

export function IndiceProductosVista({ titulo, filas, cta, colorBoton }: IndiceProductosVistaProps) {
  const [activa, setActiva] = useState(0)
  const actual = filas[Math.min(activa, filas.length - 1)]

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-10">
      <div className="flex flex-col">
        {titulo && <h2 className="titulo-legado mb-8 text-xs uppercase tracking-wide opacity-60 md:mb-16">{titulo}</h2>}
        <ol className="flex-1 space-y-1 md:space-y-2">
          {filas.map((f, i) => {
            const esActiva = i === activa
            return (
              <li key={f.id}>
                <a
                  href={f.href}
                  onMouseEnter={() => setActiva(i)}
                  onFocus={() => setActiva(i)}
                  aria-current={esActiva ? 'true' : undefined}
                  className={`group grid grid-cols-[auto_2rem_minmax(0,1fr)_auto] items-center gap-3 py-1 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current md:grid-cols-[2rem_minmax(0,1fr)_auto] md:gap-2 ${
                    esActiva ? 'opacity-100' : 'opacity-100 md:opacity-45 md:hover:opacity-100'
                  }`}
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden bg-black/5 md:hidden" style={{ borderRadius: 'var(--radio-sitio, 0px)' }} aria-hidden="true">
                    {f.foto && <img src={f.foto} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </span>
                  <span className="text-xs tabular-nums opacity-60" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate text-lg md:text-2xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
                    {f.nombre}
                  </span>
                  {f.precio !== null ? <Price value={f.precio} className="text-xs tabular-nums opacity-75" /> : <span />}
                </a>
              </li>
            )
          })}
        </ol>
        {cta && (
          <div className="mt-8 md:mt-12">
            <a
              href={cta.href}
              className="inline-flex min-h-[44px] items-center px-5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: colorBoton.fondo, color: colorBoton.texto, borderRadius: 'var(--radio-boton, 0px)', outlineColor: colorBoton.fondo }}
            >
              {cta.texto}
            </a>
          </div>
        )}
      </div>
      <div className="relative hidden overflow-hidden bg-black/5 md:block" style={{ borderRadius: 'var(--radio-sitio, 0px)' }} aria-hidden="true">
        <div className="aspect-[4/5] w-full">
          {actual.foto && <img key={actual.id} src={actual.foto} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-white/85 px-4 py-3 text-gray-900 backdrop-blur-sm" style={{ borderTop: `1px solid ${LINEA}` }}>
          <p className="min-w-0 truncate text-xs">{actual.detalle || actual.nombre}</p>
          <a
            href={actual.href}
            tabIndex={-1}
            className="shrink-0 bg-white px-4 py-2 text-xs text-gray-900 shadow-sm"
            style={{ borderRadius: 'var(--radio-boton, 0px)' }}
          >
            Ver pieza
          </a>
        </div>
      </div>
    </div>
  )
}
