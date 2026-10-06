'use client'

/**
 * Carta completa (Figma MenuFull 136:2340) — vista cliente.
 *
 * Variantes:
 *  - `anchors`:      una página con barra de categorías fija (top: --header-h),
 *                    scroll-spy con IntersectionObserver y aria-current.
 *  - `tabs`:         pestañas por carta con horario (configuradas en la
 *                    sección) y sub-filtro por categoría.
 *  - `per_category`: una URL por categoría (<página>/<slug-categoría>), chips
 *                    fijos y «Siguiente» al final.
 *  - `editorial`:    nombres grandes por categoría con la foto que sigue al
 *                    cursor (solo con @media (hover:hover)); en pantallas
 *                    táctiles, cada plato con su miniatura fija (MenuItemRow).
 *
 * Todo sale de props ya precargadas por la página: aquí no hay consultas,
 * salvo al abrir la hoja de un plato (variantes y grupos, PlatoSheet) y al
 * validar la mesa de un QR (useMesaQR).
 *
 * Restaurante (Figma F-flujos 1-2-3): la foto o el nombre abren la hoja del
 * plato; «Elegir» en platos con variantes o grupo obligatorio; etiquetas;
 * «Agotado · Vuelve…»; carta fuera de horario con «Disponible mañana desde…»;
 * banner «Cerrado ahora · abre…» con la sede cerrada; banner de mesa y barra
 * «Ver pedido (n) · total» con QR de mesa.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, ArrowUpRight, Clock, FileText, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { Price } from '@/components/site/CurrencyProvider'
import { isOptimizableImage } from '@/lib/restaurant/secciones'
import { ahoraEnZona, estadoApertura, type Apertura, type HorarioSemana } from '@/lib/restaurant/horario'
import { useMesaQR } from '@/lib/restaurant/useMesaQR'
import { cn } from '@/lib/utils'
import { addProductToCart } from '@/lib/cart'
import {
  buildMenuGroups,
  isScheduleOpen,
  mapaDeTags,
  scheduleLabel,
  unavailableLabel,
  type MenuCategoryGroup,
  type MenuItem,
  type MenuSchedule,
  type MenuSourceCategory,
  type MenuSourceProduct,
  type MenuTagSource,
} from '@/lib/menu/menuFull'
import { MenuItemRow, type MenuItemLayout, type MenuItemSize } from './MenuItemRow'
import { aplicarCambiosSedeVivos, aplicarCartaPlatos, type CartaPlatos } from '@/lib/menu/cartaPlatos'
import { useCartaSedeViva } from '@/components/sections/useCartaSedeViva'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { PlatoSheet } from './PlatoSheet'
import { BannerMesa, BarraPedidoMesa } from './BannerMesa'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

/** Sede de la carta para la hoja del plato y el banner de cerrado (sale de getSedesRestaurante). */
export interface SedeDeCarta {
  /** Nombre para «Precio de …» (solo si la organización tiene varias sedes). */
  nombre: string | null
  horario: HorarioSemana | null
  zonaHoraria: string
  /** Enlace a reservar mesa, solo si la sede acepta reservas web. */
  reservarHref: string | null
}

/**
 * `qr`: carta para el celular en la mesa (Figma «Carta completa», variante QR de mesa): banda
 * de la mesa fija arriba, pestañas por categoría en una columna y la barra «Ver pedido (n) ·
 * total». Se usa sola cuando la carta se abre desde el QR de una mesa válida, sea cual sea la
 * variante elegida en el editor; también se puede elegir como variante de la sección.
 */
export type MenuFullVariant = 'anchors' | 'tabs' | 'per_category' | 'editorial' | 'qr'

export interface MenuFullViewProps {
  variant: MenuFullVariant
  products: MenuSourceProduct[]
  categories: MenuSourceCategory[]
  selectedCategoryIds: number[] | null
  /** Orden, ocultos, destacados y textos del constructor de la carta. */
  cartaPlatos?: CartaPlatos
  schedules: MenuSchedule[]
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  pdfUrl: string | null
  layout: MenuItemLayout
  size: MenuItemSize
  columns: 1 | 2
  showDescription: boolean
  canOrder: boolean
  timeZone: string
  organizationSubdomain: string
  branchId: number | null
  sectionKey: string
  /** Etiquetas de la organización (product_tags). */
  tags?: MenuTagSource[]
  /** Sede de la carta (horario, nombre, reservas). `null` sin datos de sedes. */
  sede?: SedeDeCarta | null
  /** «Ver como» del editor: minutos simulados (solo vista previa). */
  horaSimulada?: number | null
  /** Variantes y extras que la carta del ERP no muestra, por plato (lib/menu/cartasPublicas). */
  opcionesOcultas?: OpcionesOcultas | null
}

type OpcionesOcultas = Record<number, { variantes: number[]; extras: number[] }>

const PRIMARY = 'var(--primary-color)'

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

function chipButtonClass(active: boolean) {
  return cn(
    'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm leading-5 transition-colors',
    active ? 'text-white' : 'border border-border text-foreground hover:bg-muted',
  )
}

/** Barra fija bajo el header. Fondo = el del layout del sitio (claro/oscuro). */
function StickyBar({
  children,
  label,
  barRef,
}: {
  children: React.ReactNode
  label: string
  barRef?: React.Ref<HTMLElement>
}) {
  return (
    <nav
      ref={barRef}
      aria-label={label}
      className="sticky z-30 border-b border-border bg-white py-4 dark:bg-gray-900"
      style={{ top: 'var(--header-h, 0px)' }}
    >
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </nav>
  )
}

function Intro({ eyebrow, title, subtitle }: { eyebrow: string | null; title: string | null; subtitle: string | null }) {
  if (!eyebrow && !title && !subtitle) return null
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && (
        <p className="text-xs font-medium uppercase leading-4 tracking-[0.12em]" style={{ color: 'var(--accent-color, var(--primary-color))' }}>
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="text-4xl font-bold leading-tight text-foreground md:text-5xl [font-family:var(--font-heading)]">
          {title}
        </h2>
      )}
      {subtitle && <p className="text-base leading-6 text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function platesLabel(n: number) {
  return n === 1 ? '1 plato' : `${n} platos`
}

interface ItemsGridProps {
  items: MenuItem[]
  columns: 1 | 2
  render: (item: MenuItem) => React.ReactNode
}

function ItemsGrid({ items, columns, render }: ItemsGridProps) {
  return (
    <div className={cn('grid grid-cols-1', columns === 2 && 'md:grid-cols-2 md:gap-x-12')}>
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          {render(item)}
        </div>
      ))}
    </div>
  )
}

function EmptyMenu() {
  return (
    <div className="rounded-lg border-2 border-dashed border-border py-12 text-center text-muted-foreground">
      <p>La carta aún no tiene platos publicados.</p>
    </div>
  )
}

function anchorIdFor(sectionKey: string, slug: string): string {
  return `carta-${sectionKey}-${slug}`
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ---------------------------------------------------------------------------
// Vista principal
// ---------------------------------------------------------------------------

export function MenuFullView(props: MenuFullViewProps) {
  const { products, categories, selectedCategoryIds, organizationSubdomain, branchId, cartaPlatos, tags } = props
  // Solo en el lienzo del editor (?preview=1): cambios de la sede aún sin guardar. Fuera, vacío.
  const cambiosSede = useCartaSedeViva(branchId)
  const tagsPorId = useMemo(() => mapaDeTags(tags), [tags])
  const groups = useMemo(() => {
    const base = buildMenuGroups(products, categories, selectedCategoryIds, tagsPorId)
    const conCarta = cartaPlatos ? aplicarCartaPlatos(base, cartaPlatos, selectedCategoryIds) : base
    return aplicarCambiosSedeVivos(conCarta, cambiosSede)
  }, [products, categories, selectedCategoryIds, cartaPlatos, cambiosSede, tagsPorId])

  const [platoAbierto, setPlatoAbierto] = useState<MenuItem | null>(null)
  // Variantes y extras ocultos de la pestaña desde la que se abrió el plato (cartas del ERP en
  // pestañas); `null` = los de la sección.
  const [ocultasDePestana, setOcultasDePestana] = useState<OpcionesOcultas | null>(null)
  const abrirPlato = useCallback((item: MenuItem, ocultas?: OpcionesOcultas) => {
    setPlatoAbierto(item)
    setOcultasDePestana(ocultas ?? null)
  }, [])
  const { mesa, limpiar: salirDeLaMesa } = useMesaQR(organizationSubdomain, branchId)
  const nowMinutes = useNowMinutes(props.timeZone, props.horaSimulada ?? null)
  const apertura = useAperturaSede(props.sede ?? null, props.horaSimulada ?? null)

  const handleAdd = useCallback(
    (item: MenuItem) => {
      if (item.price === null) return
      const sub = organizationSubdomain || window.location.hostname.split('.')[0]
      addProductToCart(sub, branchId, {
        id: item.id,
        name: item.name,
        price: item.price,
        sku: item.sku,
        imageUrl: item.imageUrl,
        comparePrice: item.comparePrice,
      })
    },
    [organizationSubdomain, branchId],
  )

  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <Intro eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
        <EmptyMenu />
      </div>
    )
  }

  const variantProps: VariantProps = { ...props, groups, onAdd: handleAdd, onOpen: abrirPlato, nowMinutes }
  // Con una mesa del QR (validada en el servidor) la carta pasa a la variante `qr`.
  const modoQr = props.variant === 'qr' || mesa !== null
  const cuerpo =
    modoQr ? <TabsMenu {...variantProps} columns={1} />
    : props.variant === 'tabs' ? <TabsMenu {...variantProps} />
      : props.variant === 'per_category' ? <PerCategoryMenu {...variantProps} />
        : props.variant === 'editorial' ? <EditorialMenu {...variantProps} />
          : <AnchorsMenu {...variantProps} />

  return (
    <>
      {modoQr && mesa && (
        <div className="sticky top-0 z-30 -mx-4 mb-4 bg-background/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
          <BannerMesa mesa={mesa} onSalir={salirDeLaMesa} />
        </div>
      )}
      {((!modoQr && mesa) || apertura?.estado === 'closed') && (
        <div className="mb-6 flex flex-col gap-3">
          {!modoQr && <BannerMesa mesa={mesa} onSalir={salirDeLaMesa} />}
          {apertura?.estado === 'closed' && <BannerCerrado apertura={apertura} reservarHref={props.sede?.reservarHref ?? null} canOrder={props.canOrder} />}
        </div>
      )}
      {cuerpo}
      <PlatoSheet
        item={platoAbierto}
        onClose={() => setPlatoAbierto(null)}
        canOrder={props.canOrder}
        organizationSubdomain={organizationSubdomain}
        branchId={branchId}
        sedeNombre={props.sede?.nombre ?? null}
        reservarHref={props.sede?.reservarHref ?? null}
        opcionesOcultas={platoAbierto ? (ocultasDePestana ?? props.opcionesOcultas)?.[platoAbierto.id] ?? null : null}
      />
      <BarraPedidoMesa mesa={mesa} subdomain={organizationSubdomain} branchId={branchId} />
    </>
  )
}

/** «Cerrado ahora · abre mañana a las 07:00» (Figma «Sede cerrada ahora»). */
function BannerCerrado({ apertura, reservarHref, canOrder }: { apertura: Apertura; reservarHref: string | null; canOrder: boolean }) {
  const titulo = apertura.texto.replace(/^Cerrado · Abre/, 'Cerrado ahora · abre')
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="text-sm">
            {canOrder
              ? 'Puedes ver la carta y programar tu pedido al pagar' + (reservarHref ? ', o reservar mesa.' : '.')
              : 'Puedes ver la carta' + (reservarHref ? ' o reservar mesa.' : '.')}
          </p>
        </div>
      </div>
      {reservarHref && (
        <Link
          href={reservarHref}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/60 dark:hover:bg-black/20"
          style={{ borderColor: 'var(--accent-color, var(--primary-color))', color: 'var(--accent-color, var(--primary-color))' }}
        >
          Reservar mesa
        </Link>
      )}
    </div>
  )
}

/** Estado de la sede (horario en su zona), recalculado cada minuto; con hora simulada, fijo. */
function useAperturaSede(sede: SedeDeCarta | null, horaSimulada: number | null): Apertura | null {
  const [apertura, setApertura] = useState<Apertura | null>(null)
  useEffect(() => {
    if (!sede?.horario) {
      setApertura(null)
      return
    }
    const calcular = () => {
      const ahora = ahoraEnZona(sede.zonaHoraria)
      setApertura(estadoApertura(sede.horario, horaSimulada === null ? ahora : { ...ahora, minutos: horaSimulada }))
    }
    calcular()
    if (horaSimulada !== null) return
    const id = window.setInterval(calcular, 60_000)
    return () => window.clearInterval(id)
  }, [sede, horaSimulada])
  return apertura
}

type VariantProps = MenuFullViewProps & {
  groups: MenuCategoryGroup[]
  onAdd: (item: MenuItem) => void
  /** `ocultas`: variantes y extras de la pestaña (cartas del ERP); sin ella, los de la sección. */
  onOpen: (item: MenuItem, ocultas?: OpcionesOcultas) => void
  /** Minutos «ahora» en la zona de la organización (o simulados); null hasta montar. */
  nowMinutes: number | null
}

function rowRenderer(props: VariantProps, unavailable: string | null) {
  return (item: MenuItem) => (
    <MenuItemRow
      item={item}
      layout={props.layout}
      size={props.size}
      state={unavailable ? 'unavailable' : item.soldOut ? 'sold_out' : 'default'}
      availableLabel={unavailable}
      showDescription={props.showDescription}
      canOrder={props.canOrder}
      onAdd={props.onAdd}
      onOpen={props.onOpen}
      timeZone={props.timeZone}
    />
  )
}

// ---------------------------------------------------------------------------
// anchors — una página con anclas y scroll-spy
// ---------------------------------------------------------------------------

function AnchorsMenu(props: VariantProps) {
  const { groups, sectionKey } = props
  const anchorId = (g: MenuCategoryGroup) => anchorIdFor(sectionKey, g.slug)
  const [activeId, setActiveId] = useState<number>(groups[0].id)
  const barRef = useRef<HTMLElement>(null)
  const chipRefs = useRef(new Map<number, HTMLAnchorElement>())

  // Scroll-spy: la categoría activa es la primera visible bajo la barra fija.
  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof IntersectionObserver === 'undefined') return
    const headerH = parseFloat(getComputedStyle(bar).getPropertyValue('--header-h')) || 0
    const offset = Math.round(headerH + bar.getBoundingClientRect().height)
    const visible = new Set<number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.categoryId)
          if (e.isIntersecting) visible.add(id)
          else visible.delete(id)
        }
        const first = groups.find((g) => visible.has(g.id))
        if (first) setActiveId(first.id)
      },
      { rootMargin: `-${offset}px 0px -55% 0px`, threshold: 0 },
    )
    for (const g of groups) {
      const el = document.getElementById(anchorIdFor(sectionKey, g.slug))
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [groups, sectionKey])

  // Mantener visible el chip activo dentro de la barra (solo scroll horizontal).
  useEffect(() => {
    const chip = chipRefs.current.get(activeId)
    const scroller = chip?.parentElement
    if (!chip || !scroller) return
    const left = chip.offsetLeft - scroller.clientWidth / 2 + chip.clientWidth / 2
    scroller.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [activeId])

  const onChipClick = (e: MouseEvent<HTMLAnchorElement>, g: MenuCategoryGroup) => {
    const target = document.getElementById(anchorId(g))
    if (!target) return
    e.preventDefault()
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${anchorId(g)}`)
    setActiveId(g.id)
  }

  return (
    <div>
      <StickyBar label="Categorías de la carta" barRef={barRef}>
        {groups.map((g) => (
          <a
            key={g.id}
            href={`#${anchorId(g)}`}
            aria-current={g.id === activeId ? 'true' : undefined}
            onClick={(e) => onChipClick(e, g)}
            className={chipButtonClass(g.id === activeId)}
            style={g.id === activeId ? { backgroundColor: PRIMARY } : undefined}
            ref={(el) => {
              if (el) chipRefs.current.set(g.id, el)
              else chipRefs.current.delete(g.id)
            }}
          >
            {g.name}
          </a>
        ))}
        {props.pdfUrl && (
          <a
            href={props.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex shrink-0 items-center gap-1.5 pl-4 text-sm leading-5 text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Carta en PDF
          </a>
        )}
      </StickyBar>

      <div className="flex flex-col gap-16 pt-12">
        <Intro eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
        {groups.map((g) => (
          <section
            key={g.id}
            id={anchorId(g)}
            data-category-id={g.id}
            aria-labelledby={`${anchorId(g)}-titulo`}
            className="flex flex-col gap-4"
            // La barra fija mide ~72 px; el header, --header-h.
            style={{ scrollMarginTop: 'calc(var(--header-h, 0px) + 88px)' }}
          >
            <CategoryHeading id={`${anchorId(g)}-titulo`} name={g.name} count={g.items.length} />
            <ItemsGrid items={g.items} columns={props.columns} render={rowRenderer(props, null)} />
          </section>
        ))}
      </div>
    </div>
  )
}

function CategoryHeading({ id, name, count }: { id?: string; name: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 id={id} className="text-3xl font-bold leading-10 text-foreground md:text-4xl [font-family:var(--font-heading)]">
        {name}
      </h2>
      <span className="text-sm leading-5 text-muted-foreground/70">{platesLabel(count)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// tabs — cartas con horario + sub-filtro por categoría
// ---------------------------------------------------------------------------

/**
 * Minutos actuales en la zona de la organización; null hasta montar (evita desajuste de
 * hidratación). Con hora simulada («Ver como» del editor), esa hora fija.
 */
function useNowMinutes(timeZone: string, horaSimulada: number | null): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (horaSimulada !== null) {
      setNow(horaSimulada)
      return
    }
    const tick = () => setNow(ahoraEnZona(timeZone).minutos)
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [timeZone, horaSimulada])
  return now
}

function TabsMenu(props: VariantProps) {
  const { groups, schedules, sectionKey, nowMinutes } = props

  // Sin cartas configuradas: una sola carta implícita con todas las categorías.
  const cartas: MenuSchedule[] = schedules.length > 0 ? schedules : [{ name: 'Carta' }]
  const [cartaIdx, setCartaIdx] = useState(0)
  const [userPicked, setUserPicked] = useState(false)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Al montar, abrir la primera carta en horario (si el visitante no eligió otra).
  useEffect(() => {
    if (userPicked || nowMinutes === null || schedules.length === 0) return
    const open = schedules.findIndex((s) => isScheduleOpen(s, nowMinutes))
    if (open >= 0) setCartaIdx(open)
  }, [nowMinutes, schedules, userPicked])

  const carta = cartas[Math.min(cartaIdx, cartas.length - 1)]
  const cartaGroups = useMemo(() => {
    const ids = carta.category_ids
    const deLaCarta = !ids || ids.length === 0 ? groups : groups.filter((g) => new Set(ids).has(g.id))
    // Cartas del ERP: cada pestaña con su orden, ocultos y destacados (lib/menu/cartasPublicas).
    return carta.carta ? aplicarCartaPlatos(deLaCarta, carta.carta, ids ?? null) : deLaCarta
  }, [carta, groups])

  const visibleGroups = categoryId === null ? cartaGroups : cartaGroups.filter((g) => g.id === categoryId)
  // La hoja del plato oculta las variantes y extras de ESTA pestaña (cartas del ERP).
  const ocultasPestana = carta.opcionesOcultas
  const propsDePestana: VariantProps = ocultasPestana
    ? { ...props, onOpen: (item: MenuItem) => props.onOpen(item, ocultasPestana) }
    : props
  const closed = nowMinutes !== null && schedules.length > 0 && !isScheduleOpen(carta, nowMinutes)
  // «Disponible desde las 12:00» si abre hoy más tarde; «Disponible mañana desde…» si ya pasó.
  const unavailableFrom = closed && nowMinutes !== null ? unavailableLabel(carta, nowMinutes) : null

  const selectCarta = (idx: number) => {
    setCartaIdx(idx)
    setUserPicked(true)
    setCategoryId(null)
  }

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % cartas.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + cartas.length) % cartas.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = cartas.length - 1
    else return
    e.preventDefault()
    selectCarta(next)
    tabRefs.current[next]?.focus()
  }

  const panelId = `carta-${sectionKey}-panel`

  return (
    <div className="flex flex-col gap-6">
      <Intro eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />

      {schedules.length > 0 && (
        <div role="tablist" aria-label="Cartas" className="flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cartas.map((c, idx) => {
            const selected = idx === cartaIdx
            return (
              <button
                key={`${c.name}-${idx}`}
                ref={(el) => {
                  tabRefs.current[idx] = el
                }}
                type="button"
                role="tab"
                id={`${panelId}-tab-${idx}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectCarta(idx)}
                onKeyDown={(e) => onTabKeyDown(e, idx)}
                className={cn(
                  '-mb-px shrink-0 whitespace-nowrap border-b-2 pb-3 text-sm leading-5 transition-colors md:text-base',
                  selected ? '' : 'border-transparent text-foreground hover:text-muted-foreground',
                )}
                style={selected ? { borderColor: PRIMARY, color: PRIMARY } : undefined}
              >
                {scheduleLabel(c)}
              </button>
            )
          })}
        </div>
      )}

      <div
        id={panelId}
        role={schedules.length > 0 ? 'tabpanel' : undefined}
        aria-labelledby={schedules.length > 0 ? `${panelId}-tab-${cartaIdx}` : undefined}
        className="flex flex-col gap-6"
      >
        {cartaGroups.length > 1 && (
          <div role="group" aria-label="Filtrar por categoría" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              aria-pressed={categoryId === null}
              onClick={() => setCategoryId(null)}
              className={chipButtonClass(categoryId === null)}
              style={categoryId === null ? { backgroundColor: PRIMARY } : undefined}
            >
              Todo
            </button>
            {cartaGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={categoryId === g.id}
                onClick={() => setCategoryId(g.id)}
                className={chipButtonClass(categoryId === g.id)}
                style={categoryId === g.id ? { backgroundColor: PRIMARY } : undefined}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        {visibleGroups.length === 0 ? (
          <EmptyMenu />
        ) : (
          <div className="flex flex-col gap-12">
            {visibleGroups.map((g) => (
              <section key={g.id} className="flex flex-col gap-4">
                <CategoryHeading name={g.name} count={g.items.length} />
                <ItemsGrid items={g.items} columns={props.columns} render={rowRenderer(propsDePestana, unavailableFrom)} />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// per_category — una URL por categoría
// ---------------------------------------------------------------------------

function PerCategoryMenu(props: VariantProps) {
  const { groups } = props
  const pathname = usePathname() || '/'
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  const fromPath = groups.find((g) => g.slug === last) ?? null

  // Base de la página: sin el slug de la categoría si la URL ya lo trae.
  const baseSegments = fromPath ? segments.slice(0, -1) : segments
  const basePath = baseSegments.length > 0 ? `/${baseSegments.join('/')}` : ''

  // En la home (/) no hay segmento de página: /<categoría> apuntaría a otra
  // página del builder, así que ahí se usa ?categoria=<slug>. Se lee tras
  // montar para no exigir un Suspense alrededor de useSearchParams.
  const [fromQuery, setFromQuery] = useState<string | null>(null)
  useEffect(() => {
    if (basePath !== '') return
    setFromQuery(new URLSearchParams(window.location.search).get('categoria'))
  }, [basePath, pathname])

  const current =
    fromPath ?? (fromQuery ? groups.find((g) => g.slug === fromQuery) ?? null : null) ?? groups[0]
  const idx = groups.findIndex((g) => g.id === current.id)
  const next = idx >= 0 && idx < groups.length - 1 ? groups[idx + 1] : null
  const hrefFor = (g: MenuCategoryGroup) => (basePath ? `${basePath}/${g.slug}` : `/?categoria=${encodeURIComponent(g.slug)}`)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <nav aria-label="Ruta" className="pb-4 text-sm leading-5 text-muted-foreground">
        <Link href={basePath || '/'} className="hover:text-foreground">
          {props.title || 'Carta'}
        </Link>
        <span aria-hidden="true" className="px-1.5">/</span>
        <span className="text-foreground" aria-current="page">{current.name}</span>
      </nav>

      <StickyBar label="Categorías de la carta">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={hrefFor(g)}
            aria-current={g.id === current.id ? 'page' : undefined}
            className={chipButtonClass(g.id === current.id)}
            style={g.id === current.id ? { backgroundColor: PRIMARY } : undefined}
          >
            {g.name}
          </Link>
        ))}
      </StickyBar>

      <section aria-labelledby={`carta-${props.sectionKey}-actual`} className="flex flex-col gap-4 pt-6">
        <h2
          id={`carta-${props.sectionKey}-actual`}
          className="text-3xl font-bold leading-10 text-foreground md:text-4xl [font-family:var(--font-heading)]"
        >
          {current.name}
        </h2>
        {current.description && <p className="text-base leading-6 text-muted-foreground">{current.description}</p>}
        <ItemsGrid items={current.items} columns={props.columns} render={rowRenderer(props, null)} />
      </section>

      {next && (
        <Link
          href={hrefFor(next)}
          className="mt-4 flex items-center justify-between rounded-xl border border-border px-4 py-3 text-base leading-6 text-foreground transition-colors hover:bg-muted"
        >
          Siguiente: {next.name}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// editorial — nombres grandes con foto que sigue al cursor (Figma 134:2281)
// ---------------------------------------------------------------------------

/**
 * Con puntero que hace hover: filas grandes que enlazan al plato y una foto
 * flotante que sigue al cursor. En táctil no hay hover: cada plato se pinta
 * con MenuItemRow (miniatura fija, agotado, «Agregar» si hay pedido en línea).
 * Las dos versiones se alternan con CSS (`@media (hover:hover)`), no con JS,
 * para que el HTML del servidor ya sea el correcto en cada dispositivo.
 */
function EditorialMenu(props: VariantProps) {
  const { groups } = props
  const floatRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<MenuItem | null>(null)
  const { ruta } = useRutaSitio()
  // Lienzo del editor: cada plato lleva su id para abrir el constructor de la carta.
  const enLienzo = useIsPreviewMode()

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const el = floatRef.current
    if (!el) return
    // Desplazada del puntero para no tapar el nombre del plato.
    el.style.transform = `translate3d(${e.clientX + 24}px, ${e.clientY - 190}px, 0) rotate(3deg)`
  }

  const touchRow = rowRenderer({ ...props, layout: 'photo', size: 'compact' }, null)

  return (
    <div className="flex flex-col gap-16">
      <Intro eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle} />
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`carta-${props.sectionKey}-${g.slug}`} className="flex flex-col gap-4 md:gap-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <h3
              id={`carta-${props.sectionKey}-${g.slug}`}
              className="text-xs font-medium uppercase leading-4 tracking-[0.12em]"
              style={{ color: 'var(--accent-color, var(--primary-color))' }}
            >
              {g.name}
            </h3>
            <p className="hidden text-sm leading-5 text-muted-foreground/70 [@media(hover:hover)]:block">
              Pasa el cursor por un plato para ver la foto
            </p>
          </div>

          {/* Puntero con hover */}
          <ul className="hidden flex-col [@media(hover:hover)]:flex" onMouseMove={onMove} onMouseLeave={() => setPreview(null)}>
            {g.items.map((item) => (
              <li key={item.id} data-goadmin-producto={enLienzo ? item.id : undefined}>
                <Link
                  href={ruta(`/productos/${item.uuid}`)}
                  onMouseEnter={() => setPreview(item.imageUrl ? item : null)}
                  onFocus={() => setPreview(null)}
                  className={cn(
                    'group flex items-center gap-6 border-b border-border py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    item.soldOut && 'opacity-50',
                  )}
                >
                  <span className="min-w-0 flex-1 text-3xl font-bold leading-tight text-foreground transition-colors [font-family:var(--font-heading)] group-hover:text-[color:var(--accent-color,var(--primary-color))] group-focus-visible:text-[color:var(--accent-color,var(--primary-color))] lg:text-5xl">
                    {item.name}
                  </span>
                  {item.soldOut && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-4 text-muted-foreground">Agotado</span>
                  )}
                  {item.price !== null && (
                    <Price
                      value={item.price}
                      className="shrink-0 text-lg leading-7 text-muted-foreground transition-colors group-hover:text-[color:var(--accent-color,var(--primary-color))]"
                    />
                  )}
                  <ArrowUpRight
                    className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{ color: 'var(--accent-color, var(--primary-color))' }}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>

          {/* Táctil */}
          <div className="[@media(hover:hover)]:hidden">
            {g.items.map((item) => (
              <div key={item.id}>{touchRow(item)}</div>
            ))}
          </div>
        </section>
      ))}

      {/* Foto flotante: decorativa (el nombre ya está en el enlace). */}
      <div
        ref={floatRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed left-0 top-0 z-40 hidden h-[380px] w-[300px] overflow-hidden rounded-xl bg-muted shadow-xl [@media(hover:hover)]:block',
          preview ? 'opacity-100' : 'opacity-0',
          'transition-opacity duration-200 motion-reduce:transition-none',
        )}
      >
        {preview?.imageUrl ? (
          isOptimizableImage(preview.imageUrl) ? (
            <Image src={preview.imageUrl} alt="" fill sizes="300px" className="object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa: next/image no la admite
            <img src={preview.imageUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  )
}
