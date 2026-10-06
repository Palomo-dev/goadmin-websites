'use client'

/**
 * Vista cliente de `restaurant_hero` (Figma 146:6857 / 146:6885 y móviles).
 *
 * Movimiento (notas 149:7296 y 149:7356):
 *  - typographic: cada palabra del titular sube desde una máscara (0.7 s,
 *    escalonado 80 ms); acciones con fade-up. El titular completo está en el
 *    HTML del servidor: la animación solo se añade en cliente.
 *  - split_bento: parallax ≤ 15 % del panel (no en móvil), tarjetas con
 *    fade-up escalonado, zoom 1.05 y flecha en diagonal en hover/foco.
 *  - prefers-reduced-motion: nada se mueve.
 *
 * Estado de la sede: badge «Abierto ahora · Cierra a las …» (EstadoApertura),
 * solo en cliente y recalculado cada minuto.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardVisual } from '@/lib/restaurant/secciones'
import { OpenStatusBadge, useEstadosEnVivo, type SedeConHorario } from './EstadoApertura'
import { SiteImage } from './SiteImage'
import { useParallax, useSectionMotion } from './useSectionMotion'
import m from './motion.module.css'

export type RestaurantHeroVariant = 'typographic' | 'split_bento'

export interface HeroCard {
  label: string
  url: string
  imageUrl: string | null
}

interface Cta {
  text: string
  url: string
}

export interface RestaurantHeroViewProps {
  variant: RestaurantHeroVariant
  eyebrow: string | null
  title: string
  subtitle: string | null
  primaryCta: Cta | null
  secondaryCta: Cta | null
  imageUrl: string | null
  imageAlt: string
  cards: HeroCard[]
  visual: CardVisual
  /** Sede cuyo estado se muestra; `null` = sin horario, no se muestra nada. */
  sede: SedeConHorario | null
}

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium leading-6 text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
const OUTLINE_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-base font-medium leading-6 transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

export function CtaLink({ cta, kind }: { cta: Cta; kind: 'primary' | 'outline' }) {
  return (
    <Link
      href={cta.url}
      className={kind === 'primary' ? PRIMARY_BTN : OUTLINE_BTN}
      style={
        kind === 'primary'
          ? { backgroundColor: 'var(--primary-color)', outlineColor: 'var(--primary-color)' }
          : { borderColor: 'var(--accent-color, var(--primary-color))', color: 'var(--accent-color, var(--primary-color))' }
      }
    >
      {cta.text}
    </Link>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-medium uppercase leading-4 tracking-[0.12em]"
      style={{ color: 'var(--accent-color, var(--primary-color))' }}
    >
      {children}
    </p>
  )
}

export function RestaurantHeroView(props: RestaurantHeroViewProps) {
  return props.variant === 'split_bento' ? <SplitBento {...props} /> : <Typographic {...props} />
}

/** Badge de la sede del hero; nada hasta el montaje o si la sede no tiene horario. */
function EstadoSede({ sede, className }: { sede: SedeConHorario | null; className?: string }) {
  const sedes = useMemo(() => (sede ? [sede] : []), [sede])
  const estados = useEstadosEnVivo(sedes)
  const apertura = sede ? estados?.get(sede.id)?.apertura : null
  if (!apertura) return null
  return (
    <div className={className} aria-live="polite">
      <OpenStatusBadge apertura={apertura} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// typographic
// ---------------------------------------------------------------------------

function Typographic(props: RestaurantHeroViewProps) {
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  // Líneas explícitas (saltos del editor); si no hay, palabra a palabra.
  const hasLines = props.title.includes('\n')
  const pieces = (hasLines ? props.title.split(/\r?\n/) : props.title.split(/\s+/)).filter(Boolean)
  const hasActions = props.primaryCta || props.secondaryCta

  return (
    <div ref={ref} {...motionProps} className="flex flex-col gap-6 pb-10 pt-14 md:gap-10 md:pb-24 md:pt-[120px]">
      {props.eyebrow ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Eyebrow>{props.eyebrow}</Eyebrow>
          <EstadoSede sede={props.sede} />
        </div>
      ) : (
        <EstadoSede sede={props.sede} />
      )}
      <h1
        className="break-words text-[56px] font-bold leading-none tracking-[-0.02em] text-foreground [font-family:var(--font-heading)] sm:text-[80px] lg:text-[144px] lg:leading-[0.95]"
        aria-label={props.title.replace(/\s+/g, ' ')}
      >
        {pieces.map((piece, i) => (
          <span key={i} aria-hidden="true" className={cn(hasLines && 'block')}>
            <span className={m.mask}>
              <span className={m.maskInner} style={{ '--i': i } as React.CSSProperties}>
                {piece}
              </span>
            </span>
            {!hasLines && i < pieces.length - 1 ? ' ' : null}
          </span>
        ))}
      </h1>
      {(props.subtitle || hasActions) && (
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {props.subtitle && (
            <p className="flex-1 text-base leading-6 text-muted-foreground md:text-lg md:leading-7">{props.subtitle}</p>
          )}
          {hasActions && (
            <div
              className={cn('flex flex-wrap items-center gap-3', m.fadeUp)}
              style={{ '--i': pieces.length } as React.CSSProperties}
            >
              {props.primaryCta && <CtaLink cta={props.primaryCta} kind="primary" />}
              {props.secondaryCta && <CtaLink cta={props.secondaryCta} kind="outline" />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// split_bento
// ---------------------------------------------------------------------------

function SplitBento(props: RestaurantHeroViewProps) {
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  const parallaxRef = useParallax<HTMLDivElement>(0.15)

  return (
    <div ref={ref} {...motionProps} className="flex flex-col gap-4 md:h-[min(728px,85vh)] md:flex-row">
      <div className="relative flex h-[460px] flex-col justify-end overflow-hidden rounded-xl bg-muted p-5 md:h-full md:flex-1 md:p-10" style={props.visual.media}>
        <div ref={parallaxRef} className="absolute inset-0 will-change-transform">
          <SiteImage src={props.imageUrl} alt={props.imageAlt} sizes="(min-width: 768px) 66vw, 100vw" priority />
        </div>
        <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
        <EstadoSede sede={props.sede} className="absolute left-5 top-5 md:left-10 md:top-10" />
        <div className="relative flex flex-col gap-3">
          {props.eyebrow && <p className="text-xs font-medium uppercase leading-4 tracking-[0.12em] text-white/85">{props.eyebrow}</p>}
          <h1 className="text-4xl font-bold uppercase leading-10 text-white [font-family:var(--font-heading)] md:text-6xl md:leading-[1]">
            {props.title}
          </h1>
          {props.subtitle && <p className="max-w-xl text-base leading-6 text-white/85">{props.subtitle}</p>}
          {(props.primaryCta || props.secondaryCta) && (
            <div className="mt-2 flex flex-wrap gap-3">
              {props.primaryCta && <CtaLink cta={props.primaryCta} kind="primary" />}
              {props.secondaryCta && (
                <Link
                  href={props.secondaryCta.url}
                  className="inline-flex items-center justify-center rounded-lg border border-white px-6 py-3 text-base font-medium leading-6 text-white transition-colors hover:bg-white/10"
                >
                  {props.secondaryCta.text}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {props.cards.length > 0 && (
        <nav aria-label="Accesos" className="flex flex-col gap-4 md:w-[440px] md:shrink-0">
          {props.cards.map((card, i) => (
            <Link
              key={`${card.url}-${i}`}
              href={card.url}
              className={cn(
                'relative flex h-[140px] items-end justify-between overflow-hidden rounded-xl border border-border bg-background p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:h-auto md:flex-1',
                m.zoomHost,
                m.fadeUp,
              )}
              style={{ ...props.visual.card, '--i': i, outlineColor: 'var(--primary-color)' } as React.CSSProperties}
            >
              {card.imageUrl && (
                <>
                  <div className={cn('absolute inset-0', m.zoomImg)}>
                    <SiteImage src={card.imageUrl} alt="" sizes="(min-width: 768px) 440px, 100vw" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" aria-hidden="true" />
                </>
              )}
              <span
                className={cn(
                  'relative text-2xl font-bold leading-8 [font-family:var(--font-heading)] md:text-4xl md:leading-10',
                  card.imageUrl ? 'text-white' : 'text-foreground',
                )}
              >
                {card.label}
              </span>
              <span
                aria-hidden="true"
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                <ArrowUpRight className={cn('h-5 w-5', m.arrow)} />
              </span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
