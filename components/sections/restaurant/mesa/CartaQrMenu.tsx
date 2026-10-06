'use client'

/**
 * `menu_full` · variante «qr» — la carta en la mesa (láminas 02, 11, 12, 13 y 15).
 *
 * Celular: buscador «Buscar plato o ingrediente» y botón de filtros; categorías fijas (chips);
 * filtros de dieta (product_tags.kind 'dieta' y 'picante'); tarjetas con foto, nombre,
 * descripción, etiquetas, precio siempre visible y «+» de 44 px. Agotado: «Agotado hoy · vuelve
 * …» sin «+» (lámina 12). Cocina cerrada: banda arriba y platos atenuados sin «+» (lámina 13).
 * El botón de filtros despliega «Sin …» por alérgeno (kind 'alergeno'): oculta los platos que
 * lo contienen.
 *
 * Tableta (md+, lámina 15): categorías y filtros a la izquierda, platos en dos columnas y, si la
 * página tiene «Pedido de la mesa», su panel a la derecha. El buscador va en la barra de la mesa.
 *
 * «+» agrega una unidad para el comensal actual («Yo» o su nombre); si el plato tiene variantes
 * u opciones obligatorias, abre la ficha del plato. Todo en el carrito de la sede: es la ronda
 * por enviar del pedido de la mesa.
 */

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Clock, Flame, Leaf, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { agregarPlatoAlCarrito } from '@/lib/cart'
import type { MenuCategoryGroup, MenuItem, MenuTag } from '@/lib/menu/menuFull'
import { isOptimizableImage } from '@/lib/restaurant/secciones'
import { textoPlano } from '@/lib/texto/textoPlano'
import { setMesaQR, useMesaQRStore } from '@/lib/restaurant/mesaStore'
import type { CartaQr } from '@/lib/website/v2/contrato/seccionesMesa'
import { ALERTA, C, TACTIL, TITULO } from './estilo'
import { PanelPedidoMesa } from './PedidoMesa'

interface Props {
  groups: MenuCategoryGroup[]
  config: CartaQr
  organizationSubdomain: string
  branchId: number | null
  canOrder: boolean
  /** Sede cerrada ahora (horario de la sede en su zona). */
  cocinaCerrada: { texto: string } | null
  kitchenClosedText: string
  onOpen: (item: MenuItem) => void
  preview: boolean
  conMesa: boolean
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function etiquetas(item: MenuItem): MenuTag[] {
  return item.todasLasEtiquetas ?? item.tags
}

function IconoEtiqueta({ tag }: { tag: MenuTag }) {
  if (tag.kind === 'picante' || /picante/i.test(tag.name)) return <Flame className="h-4 w-4" style={{ color: '#B5371F' }} aria-hidden="true" />
  if (tag.kind === 'dieta' && /veget|vegan/i.test(tag.name)) return <Leaf className="h-4 w-4" style={{ color: '#2E6B3A' }} aria-hidden="true" />
  return null
}

function chipEtiqueta(tag: MenuTag) {
  const color = tag.color || (tag.kind === 'dieta' ? '#2E6B3A' : tag.kind === 'picante' ? '#B5371F' : null)
  return color
    ? { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }
    : { backgroundColor: C.muySuave, color: C.suave }
}

function vuelve(item: MenuItem): string {
  if (!item.soldOutUntil) return 'Agotado hoy'
  const d = new Date(item.soldOutUntil)
  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  return d.toDateString() === manana.toDateString() || d.getTime() - Date.now() < 36 * 3600_000 ? 'Agotado hoy · vuelve mañana' : 'Agotado por ahora'
}

export function CartaQrMenu(props: Props) {
  const { groups, config } = props
  const busqueda = useMesaQRStore((e) => e.busqueda)
  const comensal = useMesaQRStore((e) => e.comensal)
  const hayPedido = useMesaQRStore((e) => e.hayPedido)
  const [categoria, setCategoria] = useState<number | null>(groups[0]?.id ?? null)
  const [dietas, setDietas] = useState<number[]>([])
  const [sinAlergenos, setSinAlergenos] = useState<number[]>([])
  const [verAlergenos, setVerAlergenos] = useState(false)
  useEffect(() => {
    if (categoria === null || !groups.some((g) => g.id === categoria)) setCategoria(groups[0]?.id ?? null)
  }, [groups, categoria])

  // Etiquetas de la carta por tipo (solo las que algún plato usa).
  const { filtrosDieta, alergenos } = useMemo(() => {
    const dieta = new Map<number, MenuTag>()
    const alerg = new Map<number, MenuTag>()
    for (const g of groups) for (const it of g.items) for (const t of etiquetas(it)) {
      if (t.kind === 'dieta' || t.kind === 'picante') dieta.set(t.id, t)
      if (t.kind === 'alergeno') alerg.set(t.id, t)
    }
    return { filtrosDieta: Array.from(dieta.values()), alergenos: Array.from(alerg.values()) }
  }, [groups])

  const q = normalizar(busqueda.trim())
  const pasa = (it: MenuItem) => {
    const ids = etiquetas(it).map((t) => t.id)
    if (dietas.length > 0 && !dietas.every((d) => ids.includes(d))) return false
    if (sinAlergenos.some((a) => ids.includes(a))) return false
    if (q && !normalizar(`${it.name} ${textoPlano(it.description) ?? ''}`).includes(q)) return false
    return true
  }
  const visibles = q
    ? groups.map((g) => ({ ...g, items: g.items.filter(pasa) })).filter((g) => g.items.length > 0)
    : groups.filter((g) => g.id === categoria).map((g) => ({ ...g, items: g.items.filter(pasa) }))

  const agregar = (it: MenuItem) => {
    if (props.preview) return
    if (it.hasVariants || it.requiresChoice) {
      props.onOpen(it)
      return
    }
    if (it.price === null) return
    const sub = props.organizationSubdomain || window.location.hostname.split('.')[0]
    agregarPlatoAlCarrito(sub, props.branchId, {
      productId: it.id,
      name: it.name,
      unitPrice: it.price,
      quantity: 1,
      sku: it.sku,
      imageUrl: it.imageUrl,
      comparePrice: it.comparePrice,
      diner: config.askDiner && props.conMesa ? comensal : null,
    })
  }

  const chip = (activo: boolean) =>
    activo
      ? { backgroundColor: C.oscuro, color: C.sobreOscuro, borderColor: C.oscuro }
      : { backgroundColor: C.tarjeta, color: C.texto, borderColor: C.borde }

  const cerrada = props.cocinaCerrada !== null

  const tarjeta = (it: MenuItem, tableta: boolean) => {
    const agotado = it.soldOut
    const apagado = agotado || cerrada
    const desc = textoPlano(it.description)
    const tags = etiquetas(it).filter((t) => t.kind !== 'alergeno').slice(0, 2)
    return (
      <article
        key={it.id}
        className={`relative flex gap-3 rounded-xl border p-3 ${tableta ? 'min-h-[176px]' : ''}`}
        style={{ borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }}
      >
        <button type="button" onClick={() => props.onOpen(it)} className={`relative shrink-0 overflow-hidden rounded-lg ${apagado ? 'opacity-50' : ''}`} style={{ width: 88, height: 88, backgroundColor: C.muySuave }} aria-label={`Ver ${it.name}`}>
          {it.imageUrl && <Image src={it.imageUrl} alt="" fill sizes="88px" className="object-cover" unoptimized={!isOptimizableImage(it.imageUrl)} />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <button type="button" onClick={() => props.onOpen(it)} className="text-left">
            <h3 className={`text-[20px] font-bold leading-6 ${apagado ? 'opacity-60' : ''}`} style={TITULO}>{it.name}</h3>
          </button>
          {desc && <p className={`mt-1 line-clamp-3 text-sm leading-5 ${apagado ? 'opacity-60' : ''}`} style={{ color: C.suave }}>{desc}</p>}
          {tags.length > 0 && !agotado && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.length > 1 && tags.every((t) => t.kind === tags[0].kind) ? (
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium" style={chipEtiqueta(tags[0])}>{tags.map((t) => t.name).join(' · ')}</span>
              ) : tags.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium" style={chipEtiqueta(t)}>
                  <IconoEtiqueta tag={t} />{t.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            {agotado ? (
              <p className="text-sm font-semibold" style={{ color: C.primario }}>{vuelve(it)}</p>
            ) : (
              it.price !== null && <Price value={it.price} className={`text-[18px] font-bold ${cerrada ? 'opacity-60' : ''}`} />
            )}
            {!apagado && props.canOrder && props.conMesa && it.price !== null && (
              <button
                type="button"
                onClick={() => agregar(it)}
                className="flex shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ width: TACTIL, height: TACTIL, backgroundColor: C.primario }}
                aria-label={`Agregar ${it.name}`}
              >
                <Plus className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </article>
    )
  }

  const encabezado = (g: MenuCategoryGroup) => (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[30px] leading-9" style={TITULO}>{g.name}</h2>
      <span className="text-sm" style={{ color: C.suave }}>{g.items.length === 1 ? '1 plato' : `${g.items.length} platos`}</span>
    </div>
  )

  const bandaCerrada = cerrada && (
    <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: ALERTA.fondo, color: ALERTA.texto }} role="status">
      <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-[17px] font-semibold">{props.cocinaCerrada!.texto}</p>
        <p className="text-sm">{props.kitchenClosedText}</p>
      </div>
    </div>
  )

  const filtros = (vertical: boolean) => (
    <>
      {config.dietFilters && filtrosDieta.map((t) => {
        const activo = dietas.includes(t.id)
        return (
          <button key={t.id} type="button" aria-pressed={activo} onClick={() => setDietas((l) => (activo ? l.filter((x) => x !== t.id) : [...l, t.id]))}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] ${vertical ? 'min-h-[38px] self-start' : 'min-h-[40px]'}`} style={chip(activo)}>
            {!vertical && <IconoEtiqueta tag={t} />}
            {t.name}
          </button>
        )
      })}
      {(verAlergenos || vertical) && alergenos.map((t) => {
        const activo = sinAlergenos.includes(t.id)
        return (
          <button key={t.id} type="button" aria-pressed={activo} onClick={() => setSinAlergenos((l) => (activo ? l.filter((x) => x !== t.id) : [...l, t.id]))}
            className={`inline-flex shrink-0 items-center rounded-full border px-4 text-[15px] ${vertical ? 'min-h-[38px] self-start' : 'min-h-[40px]'}`} style={chip(activo)}>
            Sin {t.name.toLowerCase()}
          </button>
        )
      })}
    </>
  )

  return (
    <div id="carta-qr-inicio" style={{ color: C.texto }}>
      {/* ── Celular ── */}
      <div className="md:hidden">
        {bandaCerrada && <div className="-mx-4 mb-3">{bandaCerrada}</div>}
        {config.showSearch && (
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Buscar plato o ingrediente</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.suave }} aria-hidden="true" />
              <input value={busqueda} onChange={(e) => setMesaQR({ busqueda: e.target.value.slice(0, 60) })} placeholder="Buscar plato o ingrediente"
                className="h-[52px] w-full rounded-lg border pl-11 pr-3 text-[16px]" style={{ borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }} />
            </label>
            {(alergenos.length > 0 || filtrosDieta.length > 0) && (
              <button type="button" onClick={() => setVerAlergenos((v) => !v)} aria-pressed={verAlergenos} aria-label="Filtros de dieta y alérgenos"
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border" style={chip(verAlergenos)}>
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div className="sticky z-30 -mx-4 px-4 pb-2 pt-3" style={{ top: 'var(--barra-mesa-h, 0px)', backgroundColor: C.fondo }}>
          <nav aria-label="Categorías" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.map((g) => (
              <button key={g.id} type="button" aria-current={!q && g.id === categoria ? 'true' : undefined} onClick={() => { setCategoria(g.id); setMesaQR({ busqueda: '' }) }}
                className="min-h-[40px] shrink-0 rounded-full border px-4 text-[15px]" style={chip(!q && g.id === categoria)}>
                {g.name}
              </button>
            ))}
          </nav>
          {(config.dietFilters && filtrosDieta.length > 0) || verAlergenos ? (
            <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{filtros(false)}</div>
          ) : null}
        </div>
        {visibles.length === 0 && (
          <p className="py-8 text-center" style={{ color: C.suave }}>No encontramos platos con esos filtros.</p>
        )}
        {visibles.map((g) => (
          <section key={g.id} className="mt-3">
            {encabezado(g)}
            <div className="flex flex-col gap-3">{g.items.map((it) => tarjeta(it, false))}</div>
          </section>
        ))}
        <div className="h-24" aria-hidden="true" />
      </div>

      {/* ── Tableta (lámina 15) ── */}
      <div className={`hidden md:grid ${hayPedido && props.conMesa ? 'md:grid-cols-[180px_minmax(0,1fr)_300px] lg:grid-cols-[200px_minmax(0,1fr)_340px]' : 'md:grid-cols-[180px_minmax(0,1fr)]'}`}>
        <nav aria-label="Categorías" className="flex flex-col gap-1 border-r pr-4 pt-5" style={{ borderColor: C.borde }}>
          {groups.map((g) => (
            <button key={g.id} type="button" aria-current={!q && g.id === categoria ? 'true' : undefined} onClick={() => { setCategoria(g.id); setMesaQR({ busqueda: '' }) }}
              className="min-h-[44px] rounded-lg px-3 text-left text-[16px]" style={!q && g.id === categoria ? { backgroundColor: C.oscuro, color: C.sobreOscuro } : { color: C.texto }}>
              {g.name}
            </button>
          ))}
          {(filtrosDieta.length > 0 || alergenos.length > 0) && (
            <>
              <p className="mt-3 px-1 text-sm" style={{ color: C.suave }}>Filtros</p>
              <div className="flex flex-col gap-2">{filtros(true)}</div>
            </>
          )}
        </nav>
        <div className="min-w-0 px-5 pt-5">
          {bandaCerrada && <div className="mb-4 overflow-hidden rounded-xl">{bandaCerrada}</div>}
          {visibles.length === 0 && <p className="py-8 text-center" style={{ color: C.suave }}>No encontramos platos con esos filtros.</p>}
          {visibles.map((g) => (
            <section key={g.id} className="mb-6">
              {encabezado(g)}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{g.items.map((it) => tarjeta(it, true))}</div>
            </section>
          ))}
        </div>
        {hayPedido && props.conMesa && (
          <div className="sticky top-[var(--barra-mesa-h,72px)] h-[calc(100vh-var(--barra-mesa-h,72px))]">
            <PanelPedidoMesa preview={props.preview} />
          </div>
        )}
      </div>
    </div>
  )
}
