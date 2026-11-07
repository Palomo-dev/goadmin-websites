'use client'

/**
 * `how_it_works` · «Capítulos» (plantilla «Café de especialidad», Figma 2223:46106 láminas 01, 06 y 13).
 *
 * Antetítulo, título y entrada; cada capítulo es una tarjeta con etiqueta («El origen»), número
 * (01, 02… con `show_numbers`), imagen o icono, título y texto. Contrato:
 * lib/website/v2/contrato/seccionesCafe.ts (normalizarHistoriaCapitulos).
 *
 * Movimiento (respeta «reducir movimiento» del visitante y del sitio):
 * - con cursor (`hover_motion`): la tarjeta sube 6 px, con sombra y borde de acento;
 * - en celular (`reveal_on_scroll`): carrusel deslizable y entrada suave al aparecer.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import * as Iconos from 'lucide-react'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/components/sections/restaurant/useSectionMotion'
import type { HistoriaCapitulos as DatosHistoria } from '@/lib/website/v2/contrato/seccionesCafe'

export interface EstiloTarjetaCapitulo {
  radio: number
  borde: number
  colorBorde: string | null
  fondo: string | null
  sombra: boolean
  columnas: number
  separacion: number
}

export interface HistoriaCapitulosProps {
  historia: DatosHistoria
  tarjeta: EstiloTarjetaCapitulo
}

type Icono = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

function icono(nombre: string): Icono | null {
  if (!nombre) return null
  const lista = Iconos as unknown as Record<string, Icono>
  const pascal = nombre.replace(/(^|[-_\s])([a-z])/g, (_, __, c: string) => c.toUpperCase())
  return lista[nombre] ?? lista[pascal] ?? null
}

/** Entrada al aparecer (una sola vez). Sin IntersectionObserver o con «reducir movimiento»: visible. */
function useEntrada(activa: boolean) {
  const ref = useRef<HTMLOListElement>(null)
  const [estado, setEstado] = useState<'quieto' | 'oculto' | 'visible'>('quieto')
  useEffect(() => {
    // Solo sin cursor (celular): con cursor manda la animación al pasar el cursor (contrato).
    if (!activa || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    if (!window.matchMedia('(hover: none)').matches) return
    const el = ref.current
    if (!el) return
    const caja = el.getBoundingClientRect()
    if (caja.top < window.innerHeight && caja.bottom > 0) return
    setEstado('oculto')
    const obs = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setEstado('visible')
          obs.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [activa])
  return { ref, estado }
}

export function HistoriaCapitulos({ historia, tarjeta }: HistoriaCapitulosProps) {
  const [movimiento, setMovimiento] = useState(false)
  useEffect(() => setMovimiento(!prefersReducedMotion()), [])
  const { ref, estado } = useEntrada(historia.revealOnScroll)
  const [visibleMovil, setVisibleMovil] = useState(0)
  const centrado = historia.textAlign === 'center'
  const columnas = Math.min(Math.max(tarjeta.columnas, 1), 4)

  const alDeslizar = () => {
    const el = ref.current
    if (!el || el.children.length === 0) return
    const ancho = (el.children[0] as HTMLElement).offsetWidth + 16
    setVisibleMovil(Math.min(historia.capitulos.length - 1, Math.round(el.scrollLeft / Math.max(ancho, 1))))
  }

  const estiloTarjeta: CSSProperties = {
    borderRadius: tarjeta.radio,
    borderWidth: tarjeta.borde,
    borderStyle: tarjeta.borde > 0 ? 'solid' : undefined,
    borderColor: tarjeta.colorBorde ?? 'color-mix(in srgb, var(--text-color, #111) 12%, transparent)',
    backgroundColor: tarjeta.fondo ?? 'color-mix(in srgb, var(--background-color, #fff) 70%, #fff)',
    boxShadow: tarjeta.sombra ? '0 10px 30px -18px rgb(0 0 0 / 0.35)' : undefined,
  }

  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 md:px-6', centrado && 'text-center')} data-historia-capitulos="">
      {(historia.eyebrow || historia.title || historia.subtitle) && (
        <div className={cn('mb-8 flex max-w-2xl flex-col gap-3 md:mb-12', centrado && 'mx-auto items-center')}>
          {historia.eyebrow && (
            <p className="text-xs font-medium uppercase tracking-[0.24em]" style={{ color: 'var(--accent-color, var(--primary-color))' }}>
              {historia.eyebrow}
            </p>
          )}
          {historia.title && <h2 className="text-3xl leading-tight text-foreground [font-family:var(--font-heading)] md:text-5xl">{historia.title}</h2>}
          {historia.subtitle && <p className="text-sm leading-6 text-muted-foreground md:text-base">{historia.subtitle}</p>}
        </div>
      )}

      <ol
        ref={ref}
        onScroll={alDeslizar}
        className={cn(
          // Celular: carrusel deslizable con imán. Desde md: rejilla.
          '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0',
          columnas === 2 ? 'md:grid-cols-2' : columnas === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : columnas === 1 ? 'md:grid-cols-1' : 'md:grid-cols-3',
        )}
        style={{ columnGap: tarjeta.separacion, rowGap: tarjeta.separacion }}
        aria-label={historia.title || 'Capítulos'}
      >
        {historia.capitulos.map((c, i) => {
          const Icono = icono(c.icon)
          return (
            <li
              key={`${c.numero}-${i}`}
              className={cn(
                'group flex w-[78%] shrink-0 snap-start flex-col gap-4 p-5 text-left transition-[transform,box-shadow,border-color,opacity] duration-300 ease-out sm:w-[46%] md:w-auto',
                movimiento && historia.hoverMotion && 'md:hover:-translate-y-1.5 md:hover:shadow-[0_18px_40px_-20px_rgb(0_0_0/0.35)] md:hover:[border-color:var(--accent-color,var(--primary-color))]',
                estado === 'oculto' && 'translate-y-4 opacity-0',
                estado === 'visible' && 'translate-y-0 opacity-100',
              )}
              style={{ ...estiloTarjeta, transitionDelay: estado === 'visible' ? `${i * 90}ms` : undefined }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{c.label}</span>
                {c.numero && (
                  <span className="text-lg [font-family:var(--font-heading)]" style={{ color: 'var(--accent-color, var(--primary-color))' }}>
                    {c.numero}
                  </span>
                )}
              </div>
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: historia.proporcionImagen.replace('/', ' / '), borderRadius: Math.max(tarjeta.radio - 8, 8), backgroundColor: 'color-mix(in srgb, var(--text-color, #111) 6%, transparent)' }}
              >
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen del dueño (puede ser externa)
                  <img src={c.imageUrl} alt={c.imageAlt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                ) : Icono ? (
                  <span className="absolute inset-0 flex items-center justify-center text-foreground/70">
                    <Icono className="h-14 w-14" aria-hidden={true} />
                  </span>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-5xl text-foreground/25 [font-family:var(--font-heading)]" aria-hidden="true">
                    {c.numero || String(i + 1).padStart(2, '0')}
                  </span>
                )}
              </div>
              <h3 className="text-xl leading-snug text-foreground [font-family:var(--font-heading)]">{c.title}</h3>
              {c.description && <p className="text-sm leading-6 text-muted-foreground">{c.description}</p>}
            </li>
          )
        })}
      </ol>
      {historia.capitulos.length > 1 && (
        <p className="mt-3 text-center text-xs tabular-nums text-muted-foreground md:hidden" aria-hidden="true">
          {visibleMovil + 1} / {historia.capitulos.length}
        </p>
      )}
    </div>
  )
}
