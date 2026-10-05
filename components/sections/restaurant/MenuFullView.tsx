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
 *
 * Todo sale de props ya precargadas por la página: aquí no hay consultas.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addProductToCart } from '@/lib/cart'
import {
  buildMenuGroups,
  isScheduleOpen,
  minutesInTimeZone,
  scheduleLabel,
  type MenuCategoryGroup,
  type MenuItem,
  type MenuSchedule,
  type MenuSourceCategory,
  type MenuSourceProduct,
} from '@/lib/menu/menuFull'
import { MenuItemRow, type MenuItemLayout, type MenuItemSize } from './MenuItemRow'

export type MenuFullVariant = 'anchors' | 'tabs' | 'per_category'

export interface MenuFullViewProps {
  variant: MenuFullVariant
  products: MenuSourceProduct[]
  categories: MenuSourceCategory[]
  selectedCategoryIds: number[] | null
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
}

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
  const { products, categories, selectedCategoryIds, organizationSubdomain, branchId } = props
  const groups = useMemo(
    () => buildMenuGroups(products, categories, selectedCategoryIds),
    [products, categories, selectedCategoryIds],
  )

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

  const variantProps: VariantProps = { ...props, groups, onAdd: handleAdd }
  if (props.variant === 'tabs') return <TabsMenu {...variantProps} />
  if (props.variant === 'per_category') return <PerCategoryMenu {...variantProps} />
  return <AnchorsMenu {...variantProps} />
}

type VariantProps = MenuFullViewProps & { groups: MenuCategoryGroup[]; onAdd: (item: MenuItem) => void }

function rowRenderer(props: VariantProps, unavailableFrom: string | null) {
  return (item: MenuItem) => (
    <MenuItemRow
      item={item}
      layout={props.layout}
      size={props.size}
      state={unavailableFrom ? 'unavailable' : item.soldOut ? 'sold_out' : 'default'}
      availableFrom={unavailableFrom}
      showDescription={props.showDescription}
      canOrder={props.canOrder}
      onAdd={props.onAdd}
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

/** Minutos actuales en la zona de la organización; null hasta montar (evita desajuste de hidratación). */
function useNowMinutes(timeZone: string): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(minutesInTimeZone(new Date(), timeZone))
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [timeZone])
  return now
}

function TabsMenu(props: VariantProps) {
  const { groups, schedules, sectionKey } = props
  const nowMinutes = useNowMinutes(props.timeZone)

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
    if (!ids || ids.length === 0) return groups
    const set = new Set(ids)
    return groups.filter((g) => set.has(g.id))
  }, [carta, groups])

  const visibleGroups = categoryId === null ? cartaGroups : cartaGroups.filter((g) => g.id === categoryId)
  const closed = nowMinutes !== null && schedules.length > 0 && !isScheduleOpen(carta, nowMinutes)
  const unavailableFrom = closed ? (carta.start_time?.trim() || null) : null

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
                <ItemsGrid items={g.items} columns={props.columns} render={rowRenderer(props, unavailableFrom)} />
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
