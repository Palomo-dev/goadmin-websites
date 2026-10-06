'use client'

/**
 * Vista cliente de `signature_dishes` (Figma 147:6926 / 147:7005 y móviles).
 *
 * Movimiento (notas 149:7619 y 149:7668):
 *  - carousel: scroll-snap nativo sin autoplay; tarjetas con fade-up y
 *    stagger 80 ms; zoom 1.05 de la foto solo con (hover:hover).
 *  - scrollytelling: imagen sticky con crossfade al bloque activo; bloques
 *    inactivos al 40 %. En móvil, lista apilada.
 *  - prefers-reduced-motion: scroll sin animación, sin zoom, sin crossfade y
 *    todos los bloques al 100 %.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { Price } from '@/components/site/CurrencyProvider'
import type { MenuItem } from '@/lib/menu/menuFull'
import { SiteImage } from './SiteImage'
import { SectionHeading } from './SectionHeading'
import { prefersReducedMotion, useReducedMotion, useSectionMotion } from './useSectionMotion'
import m from './motion.module.css'
import { textoPlano } from '@/lib/texto/textoPlano'

export type SignatureDishesVariant = 'carousel' | 'scrollytelling'

export type SignatureDish = MenuItem & { story: string | null }

export interface SignatureDishesViewProps {
  variant: SignatureDishesVariant
  dishes: SignatureDish[]
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  showPrice: boolean
  linkToProduct: boolean
  /** Radio de las fotos (CARD_FIELDS del editor). */
  mediaStyle: React.CSSProperties
  sectionKey: string
}

const ACCENT = 'var(--accent-color, var(--primary-color))'

function SoldOut() {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-4 text-muted-foreground">Agotado</span>
  )
}

function DishLink({ dish, enabled, className, children, style }: {
  dish: SignatureDish
  enabled: boolean
  className?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const { ruta } = useRutaSitio()
  if (!enabled) return <div className={className} style={style}>{children}</div>
  return (
    <Link href={ruta(`/productos/${dish.uuid}`)} className={className} style={style}>
      {children}
    </Link>
  )
}

export function SignatureDishesView(props: SignatureDishesViewProps) {
  return props.variant === 'scrollytelling' ? <Scrollytelling {...props} /> : <Carousel {...props} />
}

// ---------------------------------------------------------------------------
// carousel
// ---------------------------------------------------------------------------

function Carousel(props: SignatureDishesViewProps) {
  const { dishes } = props
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  const trackRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const [edges, setEdges] = useState({ start: true, end: dishes.length <= 1 })

  const step = useCallback(() => {
    const track = trackRef.current
    const first = track?.firstElementChild as HTMLElement | null
    if (!track || !first) return 0
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0
    return first.offsetWidth + gap
  }, [])

  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const s = step()
    if (s > 0) setActive(Math.min(dishes.length - 1, Math.round(track.scrollLeft / s)))
    setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
    })
  }, [dishes.length, step])

  useEffect(() => {
    onScroll()
    window.addEventListener('resize', onScroll)
    return () => window.removeEventListener('resize', onScroll)
  }, [onScroll])

  const go = (index: number) => {
    const track = trackRef.current
    if (!track) return
    const clamped = Math.max(0, Math.min(dishes.length - 1, index))
    track.scrollTo({ left: clamped * step(), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const arrowClass =
    'flex h-12 w-12 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40'
  const scrollable = !(edges.start && edges.end)
  const titleId = `platos-${props.sectionKey}`

  return (
    <div
      ref={ref}
      {...motionProps}
      className="flex flex-col gap-8"
      role="region"
      aria-roledescription="carrusel"
      aria-labelledby={props.title ? titleId : undefined}
      aria-label={props.title ? undefined : 'Platos estrella'}
    >
      <SectionHeading
        id={titleId}
        eyebrow={props.eyebrow}
        title={props.title}
        subtitle={props.subtitle}
        aside={
          scrollable ? (
            <div className="hidden shrink-0 gap-2 md:flex">
              <button type="button" className={arrowClass} onClick={() => go(active - 1)} disabled={edges.start} aria-label="Plato anterior">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" className={arrowClass} onClick={() => go(active + 1)} disabled={edges.end} aria-label="Plato siguiente">
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : null
        }
      />

      <ul
        ref={trackRef}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] md:mx-0 md:gap-6 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {dishes.map((dish, i) => (
          <li
            key={dish.id}
            className={cn('w-[78%] shrink-0 snap-start sm:w-[320px] lg:w-[400px]', m.fadeUp)}
            style={{ '--i': i } as React.CSSProperties}
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${dishes.length}: ${dish.name}`}
          >
            <DishLink
              dish={dish}
              enabled={props.linkToProduct}
              className={cn('group flex flex-col gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4', m.zoomHost)}
              style={{ outlineColor: 'var(--primary-color)' }}
            >
              <div className={cn('relative aspect-[5/6] w-full overflow-hidden rounded-xl bg-muted', dish.soldOut && 'opacity-60')} style={props.mediaStyle}>
                <div className={cn('absolute inset-0', m.zoomImg)}>
                  <SiteImage src={dish.imageUrl} alt={dish.name} sizes="(min-width: 1024px) 400px, (min-width: 640px) 320px, 78vw" />
                </div>
              </div>
              <h3 className="text-xl font-bold leading-7 text-foreground [font-family:var(--font-heading)] md:text-2xl md:leading-8">{dish.name}</h3>
              {textoPlano(dish.story || dish.description) && (
                <p className="line-clamp-3 text-sm leading-5 text-muted-foreground">{textoPlano(dish.story || dish.description)}</p>
              )}
              {(props.showPrice || dish.soldOut) && (
                <div className="flex items-center gap-3">
                  {props.showPrice && dish.price !== null && (
                    <Price value={dish.price} className="text-base font-medium leading-6" style={{ color: ACCENT }} />
                  )}
                  {dish.soldOut && <SoldOut />}
                </div>
              )}
            </DishLink>
          </li>
        ))}
      </ul>

      {scrollable && dishes.length > 1 && (
        <div className="flex items-center gap-1.5" aria-label="Elegir plato" role="group">
          {dishes.map((dish, i) => (
            <button
              key={dish.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir a ${dish.name}`}
              aria-current={i === active ? 'true' : undefined}
              className="flex h-6 items-center"
            >
              <span
                className={cn('block h-2 rounded-full transition-all', i === active ? 'w-6' : 'w-2 bg-border')}
                style={i === active ? { backgroundColor: 'var(--primary-color)' } : undefined}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// scrollytelling
// ---------------------------------------------------------------------------

function Scrollytelling(props: SignatureDishesViewProps) {
  const { dishes } = props
  const reduced = useReducedMotion()
  const { ruta } = useRutaSitio()
  const [active, setActive] = useState(0)
  const blockRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    blockRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [dishes.length])

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,620fr)_minmax(0,580fr)] md:gap-20">
      {/* Imagen fija (solo escritorio): crossfade al bloque activo. */}
      <div className="hidden md:block">
        <div
          className="sticky overflow-hidden rounded-xl bg-muted"
          style={{ ...props.mediaStyle, top: 'calc(var(--header-h, 0px) + 24px)', height: 'min(760px, calc(100vh - var(--header-h, 0px) - 48px))' }}
        >
          {dishes.map((dish, i) => (
            <div
              key={dish.id}
              className={cn('absolute inset-0', !reduced && 'transition-opacity duration-700')}
              style={{ opacity: i === active ? 1 : 0 }}
              aria-hidden={i === active ? undefined : true}
            >
              <SiteImage src={dish.imageUrl} alt={i === active ? dish.name : ''} sizes="50vw" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <SectionHeading eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} className="mb-4" />
        <ol>
          {dishes.map((dish, i) => {
            const dim = !reduced && i !== active
            return (
              <li
                key={dish.id}
                ref={(el) => {
                  blockRefs.current[i] = el
                }}
                data-index={i}
                className={cn(
                  'flex flex-col gap-4 border-b border-border py-8 md:min-h-[300px] md:justify-center md:py-12',
                  !reduced && 'md:transition-opacity md:duration-500',
                  dim && 'md:opacity-40',
                )}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted md:hidden">
                  <SiteImage src={dish.imageUrl} alt={dish.name} sizes="100vw" />
                </div>
                <p className="text-xl font-bold leading-7 [font-family:var(--font-heading)]" style={{ color: ACCENT }} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="text-3xl font-bold leading-9 text-foreground [font-family:var(--font-heading)] md:text-5xl md:leading-[48px]">
                  {props.linkToProduct ? (
                    <Link href={ruta(`/productos/${dish.uuid}`)} className="hover:underline focus-visible:underline">
                      {dish.name}
                    </Link>
                  ) : (
                    dish.name
                  )}
                </h3>
                {textoPlano(dish.story || dish.description) && (
                  <p className="text-base leading-6 text-muted-foreground md:text-lg md:leading-7">{textoPlano(dish.story || dish.description)}</p>
                )}
                {(props.showPrice || dish.soldOut) && (
                  <div className="flex items-center gap-3">
                    {props.showPrice && dish.price !== null && (
                      <Price value={dish.price} className="text-base font-medium leading-6 text-foreground" />
                    )}
                    {dish.soldOut && <SoldOut />}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
