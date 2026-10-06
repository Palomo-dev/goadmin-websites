'use client'

/**
 * Hoja del plato (Figma «Detalle: variante + extras → pedir o reservar», F-flujos 1-2-3).
 *
 * Hoja inferior en el celular y modal desde md. Foto, descripción, variante («Tamaño · elige
 * uno»), grupos de modificadores (obligatorios y opcionales, con la misma regla que exige el
 * servidor), «Nota para la cocina», cantidad, «Agregar al pedido · $ total» y «Reservar mesa».
 *
 * Datos: las variantes y los grupos se piden al abrir, a `/api/products/[id]/variants` (filtra
 * por la organización del host y aplica la carta de la sede). Los grupos de la línea salen de
 * `gruposDeProducto`, la misma función que usa el cobro: los propios de la variante elegida si
 * tiene, y si no, los del plato (lib/products/modificadores.ts).
 *
 * El precio que se escribe en el carrito es el que se ve (variante o plato + extras); el
 * servidor lo vuelve a calcular y, si difiere, responde 409 antes de cobrar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ImageIcon, Loader2, Minus, Plus, X } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import {
  ProductModifierSelector,
  type ModifierGroup,
  type ProductModifierSelectorRef,
  type SelectedModifier,
} from '@/components/site/ProductModifierSelector'
import { agregarPlatoAlCarrito, MAX_NOTA_COCINA } from '@/lib/cart'
import { getAvailableStock } from '@/lib/stock'
import { isOptimizableImage } from '@/lib/restaurant/secciones'
import { cn } from '@/lib/utils'
import { gruposDeProducto, mapaGruposDeVariantes } from '@/lib/products/modificadores'
import { filtrarOpcionesDePlato } from '@/lib/menu/cartasPublicas'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import type { MenuItem } from '@/lib/menu/menuFull'
import { textoPlano } from '@/lib/texto/textoPlano'
import { useMesaQRStore } from '@/lib/restaurant/mesaStore'

const ACCENT = 'var(--accent-color, var(--primary-color))'
const PRIMARY = 'var(--primary-color)'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

interface VarianteApi {
  id: number
  name: string
  sku?: string | null
  track_stock?: boolean
  variant_data?: Record<string, string> | null
  product_prices?: { price: number | string; compare_price?: number | string | null }[]
  product_images?: { storage_path: string | null; is_primary: boolean; shared_images?: { storage_path: string } | null }[]
  stock_levels?: { qty_on_hand: number; qty_reserved: number }[]
}

export interface PlatoSheetProps {
  item: MenuItem | null
  onClose: () => void
  /** Pedido en línea activo: sin él, la hoja informa y solo ofrece reservar. */
  canOrder: boolean
  organizationSubdomain: string
  branchId: number | null
  /** «Precio de Sede Norte.» — solo cuando la organización tiene varias sedes. */
  sedeNombre?: string | null
  /** Enlace a la reserva de mesa, solo si la sede la acepta. */
  reservarHref?: string | null
  /** Plato añadido (para el aviso de la barra «Ver pedido»). */
  onAdded?: () => void
  /** Variantes y grupos de extras que la carta del ERP no muestra («Variantes y extras»). */
  opcionesOcultas?: { variantes: number[]; extras: number[] } | null
  /**
   * Carta QR en la mesa (lámina 03): aviso de alérgenos (etiquetas kind 'alergeno') y
   * «¿Para quién es?» (comensal de la línea). `null` = la ficha de siempre.
   */
  mesaQr?: { askDiner: boolean; showAllergens: boolean } | null
}

function imagenVariante(v: VarianteApi): string | null {
  const img = v.product_images?.find((i) => i.is_primary) || v.product_images?.[0]
  const path = img?.storage_path || img?.shared_images?.storage_path
  return path ? `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}` : null
}

function precioVariante(v: VarianteApi, respaldo: number | null): number | null {
  const p = v.product_prices?.[0]?.price
  const n = p === undefined || p === null ? NaN : Number(p)
  // Variante sin precio propio: el del plato (misma regla que el cobro).
  return Number.isFinite(n) ? n : respaldo
}

function etiquetaVariante(v: VarianteApi): string {
  const valores = Object.values(v.variant_data || {}).filter(Boolean)
  return valores.length > 0 ? valores.join(' · ') : v.name
}

function tituloVariantes(variantes: VarianteApi[]): string {
  const claves = new Set<string>()
  for (const v of variantes) Object.keys(v.variant_data || {}).forEach((k) => claves.add(k))
  const nombre = claves.size > 0 ? Array.from(claves).join(' y ') : 'Opción'
  return `${nombre} · elige uno`
}

export function PlatoSheet({
  item,
  onClose,
  canOrder,
  organizationSubdomain,
  branchId,
  sedeNombre,
  reservarHref,
  onAdded,
  opcionesOcultas,
  mesaQr,
}: PlatoSheetProps) {
  // Carta QR: la ficha se monta dentro del árbol del sitio, donde viven las variables del tema
  // (--primary-color, --background-color…); en <body> no existen. Fuera de la mesa, como siempre.
  const [contenedor, setContenedor] = useState<HTMLElement | null>(null)
  const anclar = useCallback((el: HTMLSpanElement | null) => {
    if (el) setContenedor(el.parentElement)
  }, [])
  return (
    <Dialog.Root open={item !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      {mesaQr && <span hidden ref={anclar} />}
      <Dialog.Portal container={mesaQr ? contenedor ?? undefined : undefined}>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-2xl bg-white text-foreground shadow-xl outline-none dark:bg-gray-900',
            'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[88vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl',
          )}
          aria-describedby={undefined}
          // Carta QR: la ficha toma el fondo y el texto del tema (lámina 03).
          style={mesaQr ? { backgroundColor: 'var(--background-color, #ffffff)', color: 'var(--text-color, inherit)' } : undefined}
        >
          {item && (
            <ContenidoPlato
              key={item.id}
              item={item}
              onClose={onClose}
              canOrder={canOrder}
              organizationSubdomain={organizationSubdomain}
              branchId={branchId}
              sedeNombre={sedeNombre}
              reservarHref={reservarHref}
              onAdded={onAdded}
              opcionesOcultas={opcionesOcultas}
              mesaQr={mesaQr}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ContenidoPlato({
  item,
  onClose,
  canOrder,
  organizationSubdomain,
  branchId,
  sedeNombre,
  reservarHref,
  onAdded,
  opcionesOcultas,
  mesaQr,
}: PlatoSheetProps & { item: MenuItem }) {
  const comensalActual = useMesaQRStore((e) => e.comensal)
  const [comensal, setComensal] = useState<string>(comensalActual)
  const comensalesConocidos = useMesaQRStore((e) => e.pedido)
  const conComensal = !!mesaQr?.askDiner
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState(false)
  const [intento, setIntento] = useState(0)
  const [variantes, setVariantes] = useState<VarianteApi[]>([])
  const [gruposPorProducto, setGruposPorProducto] = useState<Map<number, ModifierGroup[]>>(() => new Map())
  const [varianteId, setVarianteId] = useState<number | null>(null)
  const [errorVariante, setErrorVariante] = useState(false)
  const [mods, setMods] = useState<SelectedModifier[]>([])
  const [nota, setNota] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const selectorRef = useRef<ProductModifierSelectorRef>(null)
  // En ref: cambia con el plato, que ya es dependencia de la carga; no dispara otra petición.
  const ocultasRef = useRef(opcionesOcultas ?? null)
  ocultasRef.current = opcionesOcultas ?? null

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setFallo(false)
    const qs = typeof branchId === 'number' ? `?branchId=${branchId}` : ''
    fetch(`/api/products/${item.id}/variants${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { variants?: VarianteApi[]; modifierGroups?: ModifierGroup[]; variantModifierGroups?: Record<string, ModifierGroup[]> }) => {
        if (!vivo) return
        // «Variantes y extras» de la carta: sin ocultas, la lista y los grupos de siempre.
        const visibles = filtrarOpcionesDePlato(
          Array.isArray(d.variants) ? d.variants : [],
          mapaGruposDeVariantes(item.id, d.modifierGroups, d.variantModifierGroups),
          ocultasRef.current,
        )
        const lista = visibles.variantes
        setVariantes(lista)
        // Una sola opción: elegida de entrada.
        if (lista.length === 1) setVarianteId(lista[0].id)
        setGruposPorProducto(visibles.grupos)
      })
      .catch(() => vivo && setFallo(true))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [item.id, branchId, intento])

  const conVariantes = item.hasVariants && variantes.length > 0
  const variante = conVariantes ? variantes.find((v) => v.id === varianteId) ?? null : null
  // Grupos de la línea que se va a pedir (regla única del cobro).
  const grupos = useMemo(
    () => gruposDeProducto(variante ? { id: variante.id, parent_product_id: item.id } : { id: item.id }, gruposPorProducto),
    [variante, item.id, gruposPorProducto],
  )
  // Si la variante elegida trae grupos propios, el selector se reinicia (otras opciones).
  const claveGrupos = grupos.map((g) => g.id).join('-')
  useEffect(() => {
    setMods([])
  }, [claveGrupos])
  const { ruta } = useRutaSitio()
  const base = variante ? precioVariante(variante, item.price) : item.price
  const extras = mods.reduce((s, m) => s + (m.extraPrice || 0), 0)
  const unitario = base === null ? null : base + extras
  const agotadoVariante = (v: VarianteApi) => {
    const disp = getAvailableStock(v)
    return disp !== null && disp <= 0
  }
  // Un padre con variantes cuya lista no llegó no se puede pedir desde aquí (faltaría la talla).
  const sinOpcionesDePadre = item.hasVariants && !cargando && !fallo && variantes.length === 0
  const puedePedir = canOrder && !cargando && !fallo && !sinOpcionesDePadre && unitario !== null

  const agregar = useCallback(() => {
    if (!puedePedir || unitario === null) return
    if (conVariantes && !variante) {
      setErrorVariante(true)
      document.getElementById(`plato-${item.id}-variantes`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    if (selectorRef.current && !selectorRef.current.validate()) return
    const sub = organizationSubdomain || window.location.hostname.split('.')[0]
    agregarPlatoAlCarrito(sub, branchId, {
      productId: variante ? variante.id : item.id,
      name: variante ? variante.name : item.name,
      unitPrice: unitario,
      quantity: cantidad,
      sku: variante ? variante.sku ?? null : item.sku,
      imageUrl: (variante && imagenVariante(variante)) || item.imageUrl,
      comparePrice: variante ? null : item.comparePrice,
      modifiers: mods,
      notes: nota,
      variantAttributes: variante?.variant_data ?? null,
      ...(conComensal ? { diner: comensal } : {}),
    })
    onAdded?.()
    onClose()
  }, [puedePedir, unitario, conVariantes, variante, item, organizationSubdomain, branchId, cantidad, mods, nota, onAdded, onClose, conComensal, comensal])

  // Alérgenos (lámina 03): «Contiene lácteos y mostaza. Sin gluten.»
  const todas = item.todasLasEtiquetas ?? item.tags
  const alergenos = mesaQr?.showAllergens ? todas.filter((t) => t.kind === 'alergeno').map((t) => t.name.toLowerCase()) : []
  const sinAlergeno = mesaQr?.showAllergens ? todas.filter((t) => t.kind === 'dieta' && /^sin /i.test(t.name)).map((t) => t.name) : []
  const avisoAlergenos = alergenos.length > 0 || sinAlergeno.length > 0
    ? [
        alergenos.length > 0 ? `Contiene ${alergenos.length > 1 ? `${alergenos.slice(0, -1).join(', ')} y ${alergenos[alergenos.length - 1]}` : alergenos[0]}.` : null,
        sinAlergeno.length > 0 ? `${sinAlergeno.join(', ')}.` : null,
      ].filter(Boolean).join(' ')
    : null
  // Comensales para «¿Para quién es?»: yo, los de las rondas de la mesa y los nuevos.
  const [nuevos, setNuevos] = useState<string[]>([])
  const [escribiendo, setEscribiendo] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const nombres = useMemo(() => {
    const lista = [comensalActual]
    for (const r of comensalesConocidos?.rondas ?? []) for (const l of r.items) {
      const n = l.comensal ?? r.comensal
      if (n && !/^Comensal \d+$/.test(n) && !lista.includes(n)) lista.push(n)
    }
    for (const n of nuevos) if (!lista.includes(n)) lista.push(n)
    return lista.slice(0, 12)
  }, [comensalActual, comensalesConocidos, nuevos])

  const foto = (variante && imagenVariante(variante)) || item.imageUrl
  const descripcion = textoPlano(item.description)

  return (
    <>
      <div className="relative">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden="true" />
        {foto ? (
          <div className={cn('relative mt-2 w-full bg-muted md:mt-0', mesaQr ? 'h-[260px] md:h-72' : 'h-48 md:h-56')}>
            <Image src={foto} alt={item.name} fill sizes="(min-width: 768px) 512px, 100vw" className="object-cover" unoptimized={!isOptimizableImage(foto)} />
          </div>
        ) : null}
        <Dialog.Close
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-foreground shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 dark:bg-gray-800/90"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Dialog.Close>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
        {mesaQr ? (
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-[30px] leading-9 [font-family:var(--font-heading)]">{item.name}</Dialog.Title>
            {unitario !== null && <Price value={base ?? unitario} className="mt-1 shrink-0 text-xl font-bold" />}
          </div>
        ) : (
          <Dialog.Title className="pr-10 text-2xl font-bold leading-tight [font-family:var(--font-heading)]">{item.name}</Dialog.Title>
        )}
        {(descripcion || sedeNombre) && (
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {descripcion}
            {descripcion && sedeNombre ? ' ' : ''}
            {sedeNombre ? `Precio de ${sedeNombre}.` : ''}
          </p>
        )}
        {!foto && !descripcion && (
          <div className="mt-3 flex h-20 items-center justify-center rounded-xl bg-muted" aria-hidden="true">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        {avisoAlergenos && (
          <p className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium" style={{ backgroundColor: '#F8EBC8', color: '#7A5200' }} role="note">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {avisoAlergenos}
          </p>
        )}
        {item.tags.length > 0 && !mesaQr && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Etiquetas">
            {item.tags.map((t) => (
              <li
                key={t.id}
                className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', !t.color && 'border-border bg-muted text-muted-foreground')}
                style={t.color ? { borderColor: t.color, color: t.color } : undefined}
              >
                {t.name}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-col gap-5">
          {cargando && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando opciones…
            </p>
          )}
          {fallo && (
            <div className="rounded-lg border border-border p-3 text-sm" role="alert">
              <p>No pudimos cargar las opciones de este plato.</p>
              <div className="mt-2 flex gap-4">
                <button type="button" className="font-medium underline" style={{ color: ACCENT }} onClick={() => setIntento((n) => n + 1)}>
                  Intentar de nuevo
                </button>
                <Link href={ruta(`/productos/${item.uuid}`)} className="font-medium underline" style={{ color: ACCENT }}>
                  Ver el plato
                </Link>
              </div>
            </div>
          )}
          {sinOpcionesDePadre && (
            <p className="text-sm text-muted-foreground" role="status">Este plato no tiene opciones disponibles ahora.</p>
          )}

          {conVariantes && (
            <fieldset id={`plato-${item.id}-variantes`} aria-invalid={errorVariante || undefined}>
              <legend className="mb-2 text-sm font-semibold">{tituloVariantes(variantes)}</legend>
              <div role="radiogroup" aria-label={tituloVariantes(variantes)} className="space-y-1.5">
                {variantes.map((v) => {
                  const elegida = v.id === varianteId
                  const precio = precioVariante(v, item.price)
                  const agotada = agotadoVariante(v)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={elegida}
                      disabled={agotada || precio === null}
                      onClick={() => {
                        setVarianteId(v.id)
                        setErrorVariante(false)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        elegida ? 'border-2' : 'border-border hover:bg-muted',
                      )}
                      style={elegida ? { borderColor: PRIMARY } : undefined}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-4 w-4 items-center justify-center rounded-full border-2"
                          style={elegida ? { borderColor: PRIMARY } : undefined}
                        >
                          {elegida && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIMARY }} />}
                        </span>
                        {etiquetaVariante(v)}
                        {agotada && <span className="text-muted-foreground"> · agotado</span>}
                      </span>
                      {precio !== null && <Price value={precio} className="text-muted-foreground" />}
                    </button>
                  )
                })}
              </div>
              {errorVariante && (
                <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Elige una opción para continuar.
                </p>
              )}
            </fieldset>
          )}

          {!cargando && !fallo && grupos.length > 0 && (
            <ProductModifierSelector key={claveGrupos} ref={selectorRef} groups={grupos} primaryColor={PRIMARY} onChange={setMods} />
          )}

          {canOrder && !cargando && !fallo && (
            <div>
              <label htmlFor={`plato-${item.id}-nota`} className="mb-1.5 block text-sm font-semibold">
                Nota para la cocina <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <textarea
                id={`plato-${item.id}-nota`}
                value={nota}
                onChange={(e) => setNota(e.target.value.slice(0, MAX_NOTA_COCINA))}
                maxLength={MAX_NOTA_COCINA}
                rows={2}
                placeholder="Ej.: sin cilantro, por favor"
                className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2"
              />
            </div>
          )}

          {conComensal && canOrder && !cargando && !fallo && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">¿Para quién es?</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="¿Para quién es?">
                {nombres.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={comensal === n} onClick={() => setComensal(n)}
                    className="min-h-[40px] rounded-full border px-4 text-sm"
                    style={comensal === n ? { backgroundColor: 'var(--text-color, #1f1a14)', color: 'var(--background-color, #fff)', borderColor: 'var(--text-color, #1f1a14)' } : undefined}>
                    {n}
                  </button>
                ))}
                {escribiendo ? (
                  <form className="flex gap-2" onSubmit={(e) => {
                    e.preventDefault()
                    const n = nombreNuevo.trim().slice(0, 40)
                    if (n) {
                      setNuevos((l) => [...l, n])
                      setComensal(n)
                    }
                    setNombreNuevo('')
                    setEscribiendo(false)
                  }}>
                    <input autoFocus value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} maxLength={40} placeholder="Nombre"
                      className="h-10 w-32 rounded-full border border-border bg-transparent px-3 text-sm" aria-label="Nombre del comensal" />
                    <button type="submit" className="h-10 rounded-full border border-border px-3 text-sm font-semibold">Listo</button>
                  </form>
                ) : (
                  <button type="button" onClick={() => setEscribiendo(true)} className="min-h-[40px] rounded-full border border-border px-4 text-sm">+ Nombre</button>
                )}
              </div>
            </fieldset>
          )}

          {!canOrder && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              El pedido en línea no está disponible en este momento.
            </p>
          )}
        </div>
      </div>

      {mesaQr && canOrder ? (
        // Carta QR (lámina 03): cantidad y «Agregar · $» en una sola fila.
        <div className="flex items-stretch gap-3 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center rounded-lg border border-border">
            <button type="button" onClick={() => setCantidad((q) => Math.max(1, q - 1))} className="flex h-full w-11 items-center justify-center disabled:opacity-40" disabled={cantidad <= 1} aria-label="Quitar uno">
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="min-w-[2.5rem] text-center text-lg font-semibold" aria-live="polite">{cantidad}</span>
            <button type="button" onClick={() => setCantidad((q) => Math.min(99, q + 1))} className="flex h-full w-11 items-center justify-center" aria-label="Agregar uno">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={agregar}
            disabled={!puedePedir}
            className="inline-flex min-h-[56px] flex-1 items-center justify-center rounded-lg px-4 text-[17px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: PRIMARY, color: 'var(--texto-sobre-primario, #ffffff)' }}
          >
            Agregar{unitario !== null && <>&nbsp;·&nbsp;<Price value={unitario * cantidad} /></>}
          </button>
        </div>
      ) : (
      <div className="border-t border-border px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {canOrder && (
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cantidad</span>
            <div className="flex items-center rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setCantidad((q) => Math.max(1, q - 1))}
                className="p-2 hover:bg-muted disabled:opacity-40"
                disabled={cantidad <= 1}
                aria-label="Quitar uno"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[2.5rem] text-center font-semibold" aria-live="polite">{cantidad}</span>
              <button type="button" onClick={() => setCantidad((q) => Math.min(99, q + 1))} className="p-2 hover:bg-muted" aria-label="Agregar uno">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 md:flex-row">
          {canOrder && (
            <button
              type="button"
              onClick={agregar}
              disabled={!puedePedir}
              className="inline-flex flex-1 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: PRIMARY }}
            >
              {unitario !== null ? (
                <>
                  {mesaQr ? 'Agregar' : 'Agregar al pedido'} ·&nbsp;<Price value={unitario * cantidad} />
                </>
              ) : (
                'Agregar al pedido'
              )}
            </button>
          )}
          {reservarHref && (
            <>
              <Link
                href={reservarHref}
                onClick={onClose}
                className={cn(
                  'items-center justify-center rounded-lg border px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted',
                  canOrder ? 'hidden md:inline-flex' : 'inline-flex flex-1',
                )}
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                Reservar mesa
              </Link>
              {canOrder && (
                <Link href={reservarHref} onClick={onClose} className="py-1 text-center text-sm font-medium md:hidden" style={{ color: ACCENT }}>
                  Prefiero reservar mesa
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </>
  )
}

export default PlatoSheet
