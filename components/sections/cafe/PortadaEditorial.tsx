'use client'

/**
 * `hero` · «Carrusel editorial» (plantilla «Café de especialidad», Figma 2223:46106 láminas 01 y 12).
 *
 * Las fotos rotan; el antetítulo, el título, el subtítulo (en cursiva con `subtitle_style`) y hasta
 * 3 botones quedan fijos. Contrato: lib/website/v2/contrato/seccionesCafe.ts (normalizarPortadaEditorial).
 *
 * Movimiento: fundido (o deslizar / acercar) cada `interval_ms`; se pausa al pasar el cursor, con
 * el foco dentro y con «reducir movimiento» (del visitante o del sitio: entonces no rota sola).
 * Sin fotos: la portada de la sede y, sin ella, el degradado del tema.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/lib/website/botonSitio'
import { RESPALDO_HEADER_PX } from '@/lib/website/espacioHeader'
import { prefersReducedMotion } from '@/components/sections/restaurant/useSectionMotion'
import type { PortadaEditorial as DatosPortada } from '@/lib/website/v2/contrato/seccionesCafe'

export interface PortadaEditorialProps {
  portada: DatosPortada
  titulo: string | null
  subtitulo: string | null
  mostrarBotones: boolean
  /** Portada de la sede cuando no hay fotos (`branches.website_cover_url`). */
  fotoRespaldo: string | null
  /** El encabezado transparente va encima: se reserva su alto (`--header-h`). */
  solapaEncabezado: boolean
}

const ALTURAS: Record<string, string> = {
  '100vh': 'min-h-[100svh]',
  '70vh': 'min-h-[70svh]',
  '50vh': 'min-h-[50svh]',
}

const POSICION_VERTICAL: Record<string, string> = { top: 'items-start', middle: 'items-center', bottom: 'items-end' }
const POSICION_HORIZONTAL: Record<string, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

/** Relleno blanco con flecha (`solid`, el default del contrato) o contorno claro (`outline`, `ghost`, `link`). */
function Boton({ boton }: { boton: DatosPortada['botones'][number] }) {
  const externo = /^https?:\/\//i.test(boton.url)
  const solido = boton.variant === 'solid'
  return (
    <Link
      href={boton.url}
      {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...(solido ? BOTON_PRIMARIO : BOTON_SECUNDARIO)}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40',
        solido ? 'bg-white text-neutral-900 hover:bg-white/90' : 'border border-white/50 text-white hover:bg-white/10',
      )}
    >
      {boton.label}
      {solido && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
    </Link>
  )
}

export function PortadaEditorial({ portada, titulo, subtitulo, mostrarBotones, fotoRespaldo, solapaEncabezado }: PortadaEditorialProps) {
  const fotos = portada.fotos.length > 0 ? portada.fotos : fotoRespaldo ? [{ imageUrl: fotoRespaldo, imageUrlMobile: '', alt: '' }] : []
  const total = fotos.length
  const [actual, setActual] = useState(0)
  const [pausa, setPausa] = useState(false)
  const [sinMovimiento, setSinMovimiento] = useState(true)
  const inicioToque = useRef<number | null>(null)

  useEffect(() => setSinMovimiento(prefersReducedMotion()), [])

  const ir = useCallback(
    (i: number) => {
      if (total < 2) return
      if (!portada.loop && (i < 0 || i >= total)) return
      setActual(((i % total) + total) % total)
    },
    [total, portada.loop],
  )

  useEffect(() => {
    if (!portada.autoplay || sinMovimiento || pausa || total < 2) return
    if (!portada.loop && actual >= total - 1) return
    const t = window.setTimeout(() => ir(actual + 1), portada.intervalMs)
    return () => window.clearTimeout(t)
  }, [portada.autoplay, portada.intervalMs, portada.loop, sinMovimiento, pausa, total, actual, ir])

  const alTocar = (e: PointerEvent<HTMLElement>) => {
    if (portada.enableSwipe && e.pointerType !== 'mouse') inicioToque.current = e.clientX
  }
  const alSoltar = (e: PointerEvent<HTMLElement>) => {
    const inicio = inicioToque.current
    inicioToque.current = null
    if (inicio === null) return
    const dx = e.clientX - inicio
    if (Math.abs(dx) > 40) ir(actual + (dx < 0 ? 1 : -1))
  }
  const alTecla = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') ir(actual + 1)
    else if (e.key === 'ArrowLeft') ir(actual - 1)
  }

  const [vertical, horizontal] = portada.contentPosition.split('-')
  const alineado = portada.textAlign === 'center' ? 'text-center items-center' : portada.textAlign === 'right' ? 'text-right items-end' : 'text-left items-start'
  const estiloRaiz: CSSProperties = solapaEncabezado ? { paddingTop: `var(--header-h, ${RESPALDO_HEADER_PX}px)` } : {}
  const transicion = sinMovimiento ? 'fade' : portada.transition

  return (
    <div
      className={cn('relative isolate flex w-full overflow-hidden text-white', ALTURAS[portada.height] ?? 'min-h-[560px]', POSICION_VERTICAL[vertical] ?? 'items-center')}
      style={estiloRaiz}
      role={total > 1 ? 'region' : undefined}
      aria-roledescription={total > 1 ? 'carrusel' : undefined}
      aria-label={total > 1 ? titulo || 'Portada' : undefined}
      onMouseEnter={() => portada.pauseOnHover && setPausa(true)}
      onMouseLeave={() => portada.pauseOnHover && setPausa(false)}
      onFocusCapture={() => setPausa(true)}
      onBlurCapture={() => setPausa(false)}
      onPointerDown={alTocar}
      onPointerUp={alSoltar}
      onKeyDown={total > 1 ? alTecla : undefined}
      data-portada-editorial=""
    >
      {/* Fotos (o el degradado del tema) */}
      <div className="absolute inset-0 -z-10" aria-hidden={total === 0 ? true : undefined}>
        {total === 0 ? (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, var(--primary-color, #3f3a2f), color-mix(in srgb, var(--primary-color, #3f3a2f) 55%, #000))' }}
          />
        ) : (
          fotos.map((f, i) => {
            const visible = i === actual
            const desplazamiento = transicion === 'slide' ? `translateX(${(i - actual) * 100}%)` : transicion === 'zoom' && visible ? 'scale(1.04)' : 'none'
            return (
              <picture
                key={`${f.imageUrl}-${i}`}
                className={cn('absolute inset-0 block transition-[opacity,transform] duration-700 ease-out', transicion === 'slide' ? 'opacity-100' : visible ? 'opacity-100' : 'opacity-0')}
                style={{ transform: desplazamiento, transitionDuration: transicion === 'zoom' ? '1200ms' : undefined }}
                aria-hidden={visible ? undefined : true}
              >
                {f.imageUrlMobile && f.imageUrlMobile !== f.imageUrl && <source media="(max-width: 767px)" srcSet={f.imageUrlMobile} />}
                {/* eslint-disable-next-line @next/next/no-img-element -- portada a todo el ancho, igual que HeroFullscreen */}
                <img
                  src={f.imageUrl}
                  alt={visible ? f.alt : ''}
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  {...(i === 0 ? { fetchPriority: 'high' as const } : {})}
                />
              </picture>
            )
          })
        )}
        {portada.showOverlay && total > 0 && (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, rgb(0 0 0 / ${Math.min(1, portada.overlayOpacity / 100 + 0.15)}) 0%, rgb(0 0 0 / ${portada.overlayOpacity / 100}) 55%, rgb(0 0 0 / ${Math.max(0, portada.overlayOpacity / 100 - 0.1)}) 100%)`,
            }}
          />
        )}
      </div>

      {/* Texto y botones fijos */}
      <div className={cn('mx-auto flex w-full max-w-7xl px-6 py-16 md:px-10 md:py-24', POSICION_HORIZONTAL[horizontal] ?? 'justify-start')}>
        <div className={cn('flex max-w-2xl flex-col gap-5', alineado)}>
          {portada.eyebrow && <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/80">{portada.eyebrow}</p>}
          {titulo && (
            <h1 className="text-4xl leading-[1.05] [font-family:var(--font-heading)] sm:text-5xl md:text-6xl lg:text-7xl">{titulo}</h1>
          )}
          {subtitulo && (
            <p className={cn('max-w-xl text-base leading-relaxed text-white/90 md:text-lg', portada.subtitleStyle === 'italic' && 'italic [font-family:var(--font-heading)]')}>
              {subtitulo}
            </p>
          )}
          {mostrarBotones && portada.botones.length > 0 && (
            <div className={cn('mt-2 flex flex-wrap gap-3', portada.textAlign === 'center' ? 'justify-center' : portada.textAlign === 'right' ? 'justify-end' : 'justify-start')}>
              {portada.botones.map((b, i) => (
                <Boton key={`${b.url}-${i}`} boton={b} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controles */}
      {total > 1 && portada.showArrows && (
        <>
          <button type="button" onClick={() => ir(actual - 1)} className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 text-white hover:bg-white/10 md:flex" aria-label="Foto anterior">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => ir(actual + 1)} className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 text-white hover:bg-white/10 md:flex" aria-label="Foto siguiente">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      )}
      {total > 1 && portada.showDots && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5" role="group" aria-label="Fotos de la portada">
          {fotos.map((f, i) => (
            <button
              key={`punto-${i}`}
              type="button"
              onClick={() => ir(i)}
              aria-label={`Foto ${i + 1} de ${total}${f.alt ? `: ${f.alt}` : ''}`}
              aria-current={i === actual ? 'true' : undefined}
              className="flex h-6 min-w-6 items-center justify-center"
            >
              {portada.dotStyle === 'numbers' ? (
                <span className={cn('text-xs tabular-nums', i === actual ? 'text-white' : 'text-white/60')}>{String(i + 1).padStart(2, '0')}</span>
              ) : (
                <span
                  className={cn('block rounded-full bg-white transition-all', i === actual ? 'opacity-100' : 'opacity-50', portada.dotStyle === 'bars' ? (i === actual ? 'h-1 w-6' : 'h-1 w-1.5') : 'h-2 w-2')}
                />
              )}
            </button>
          ))}
        </div>
      )}
      {total > 1 && fotos[actual]?.alt && (
        <p className="absolute bottom-6 right-6 hidden text-[11px] text-white/70 md:block" aria-hidden="true">
          Foto {actual + 1} de {total} · {fotos[actual].alt}
        </p>
      )}
    </div>
  )
}
