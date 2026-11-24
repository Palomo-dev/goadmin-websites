'use client'

/**
 * Etiquetas en la ficha del producto (Figma «16 Sitio web» 3036:78040, aprobado el 2026-11-24).
 *
 *  - A, sobre la foto (3037:78060 escritorio, 3037:78426 celular): pilas en las esquinas de la
 *    foto principal (`EtiquetasSobreFoto`, la monta `ProductImageGallery`), sin tapar flechas ni
 *    puntos.
 *  - B, junto al título (3038:78227, 3038:78623): una fila (`FilaEtiquetasFicha`, la monta
 *    `ProductInfo`). «2 X 1» se toca y explica la promoción real (3039:78582: ventana en el
 *    computador, hoja desde abajo en el celular) con la cuenta del motor del cobro y «Llevar 2»;
 *    «Precio por volumen» baja a la tabla «Compra más, paga menos». El descuento pasa a rojo junto
 *    al precio (`useColorDescuentoFicha`, lo lee `PrecioFicha`).
 *
 * Opciones: contenido del bloque `product_info` (`leerOpcionesEtiquetasFicha`, seccionesFicha.ts).
 * Cuándo sale cada etiqueta, su texto y su color: `lib/website/etiquetasProducto.ts`, la misma
 * regla de la tarjeta. Promoción real: `usePromoProducto` (en memoria, cargada por el layout);
 * volumen: `useVolumenFicha`. Sin `labels_show`, ningún proveedor y la ficha de hoy.
 */
import { createContext, useContext, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { BadgeCheck, ChevronDown, Layers, ShieldCheck, Star, TrendingUp, Truck, X, Zap } from 'lucide-react'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { useEstiloTarjeta, useEstiloTarjetaSitio } from '@/components/site/TarjetaProductoContext'
import { useVolumenFicha } from '@/components/site/volumen/EscalonesTiendaContext'
import { usePromoProducto, useZonaPromos } from '@/components/site/etiquetas/PromosEtiquetaContext'
import { resumenTarjeta, type ProductoEscalones } from '@/lib/promociones/escalonesTienda'
import { explicarPromo, fechaFinPromo, textoEtiquetaPromo, type PromoEtiquetaTienda } from '@/lib/promociones/etiquetasPromocion'
import { pedirCantidad } from '@/lib/products/pedirCantidad'
import {
  colorDescuentoFicha,
  etiquetasFicha,
  type DatosEtiquetaProducto,
  type EtiquetaFichaPintada,
  type IconoEtiqueta,
} from '@/lib/website/etiquetasProducto'
import { etiquetasEn, type OpcionesEtiquetasFicha } from '@/lib/website/v2/seccionesFicha'
import { textoContraste } from '@/lib/website/tarjetaProducto'

interface EtiquetasFichaValor {
  opciones: OpcionesEtiquetasFicha
  producto: ProductoEscalones
  datos: DatosEtiquetaProducto
  /** Precio de la unidad (el de la ficha). */
  precio: number
  /** Ids de las variantes (para «Llevar 2», que pide la cantidad al selector de la ficha). */
  variantes: number[]
  /** La Galería tiene apagado «Etiquetas sobre la foto» (`show_badges: false`). */
  sinFoto: boolean
  primaryColor: string
}

const EtiquetasFichaContext = createContext<EtiquetasFichaValor | null>(null)

/** Lo monta ProductDetailRenderer solo con `labels_show: true`. */
export function ProveedorEtiquetasFicha({ children, ...valor }: EtiquetasFichaValor & { children: ReactNode }) {
  const { opciones, producto, datos, precio, variantes, sinFoto, primaryColor } = valor
  const memo = useMemo(
    () => ({ opciones, producto, datos, precio, variantes, sinFoto, primaryColor }),
    [opciones, producto, datos, precio, variantes, sinFoto, primaryColor],
  )
  return <EtiquetasFichaContext.Provider value={memo}>{children}</EtiquetasFichaContext.Provider>
}

/** ¿La ficha tiene las etiquetas encendidas? (la galería deja su insignia de volumen de siempre). */
export function useFichaConEtiquetas(): boolean {
  return useContext(EtiquetasFichaContext)?.opciones.mostrar === true
}

/** Colores del descuento junto al precio en B (rojo). null = el verde de hoy. */
export function useColorDescuentoFicha(): { bg: string; text: string } | null {
  const ctx = useContext(EtiquetasFichaContext)
  const estilo = useEstiloTarjeta()
  return ctx ? colorDescuentoFicha(ctx.opciones, estilo) : null
}

function useEtiquetas(donde: 'foto' | 'titulo'): { lista: EtiquetaFichaPintada[]; promo: PromoEtiquetaTienda | null; ctx: EtiquetasFichaValor | null } {
  const ctx = useContext(EtiquetasFichaContext)
  const estilo = useEstiloTarjeta()
  const estiloSitio = useEstiloTarjetaSitio()
  const { formatPrice } = useCurrency()
  const promo = usePromoProducto(ctx?.producto ?? null)
  const volumen = useVolumenFicha()
  const lista = useMemo(() => {
    if (!ctx || !etiquetasEn(ctx.opciones.ubicacion, donde) || (donde === 'foto' && ctx.sinFoto)) return []
    const r = volumen && !volumen.requiereCliente ? resumenTarjeta(volumen.escalones, ctx.precio) : null
    return etiquetasFicha(ctx.opciones, estilo, estiloSitio, {
      ...ctx.datos,
      promoTexto: promo ? textoEtiquetaPromo(promo, formatPrice) : null,
      volumenTexto: r ? `Desde ${r.desde}: −${r.ahorroPct} %` : null,
    }, ctx.primaryColor, donde)
  }, [ctx, estilo, estiloSitio, promo, volumen, formatPrice, donde])
  return { lista, promo, ctx }
}

const ICONOS: Record<IconoEtiqueta, typeof Truck> = {
  truck: Truck, layers: Layers, trending: TrendingUp, check: BadgeCheck, shield: ShieldCheck, star: Star, zap: Zap,
}

const RADIO: Record<EtiquetaFichaPintada['forma'], string> = {
  pill: 'rounded-full', rounded: 'rounded-md', semi: 'rounded-[10px]', square: 'rounded-none',
}

function claseChip(e: EtiquetaFichaPintada, tamano: 'sm' | 'md'): string {
  const t = tamano === 'sm' ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1 px-2.5 py-1 text-xs'
  return `inline-flex items-center whitespace-nowrap font-semibold leading-4 shadow-sm ${RADIO[e.forma]} ${t}`
}

function estiloChip(e: EtiquetaFichaPintada): CSSProperties {
  return { backgroundColor: e.bg_color, color: e.text_color, ...(e.extra_style ?? {}) }
}

function Contenido({ e, conFlecha = false }: { e: EtiquetaFichaPintada; conFlecha?: boolean }) {
  const Icono = e.icono ? ICONOS[e.icono] : null
  return (
    <>
      {Icono && <Icono className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
      {e.texto}
      {conFlecha && <ChevronDown className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
    </>
  )
}

// ── A: sobre la foto ─────────────────────────────────────────────────────────────────────────────

const ESQUINAS = [
  ['top_left', 'left-3 top-3 items-start'],
  ['top_right', 'right-3 top-3 items-end'],
  ['bottom_left', 'bottom-3 left-3 items-start'],
  ['bottom_right', 'bottom-3 right-3 items-end'],
] as const

/** Pilas de etiquetas en las esquinas de la foto principal (va dentro de un contenedor `relative`). */
export function EtiquetasSobreFoto() {
  const { lista, ctx } = useEtiquetas('foto')
  if (!ctx || lista.length === 0) return null
  return (
    <>
      {ESQUINAS.map(([esquina, clase]) => {
        const propias = lista.filter((e) => e.esquina === esquina)
        if (propias.length === 0) return null
        return (
          <div key={esquina} className={`pointer-events-none absolute z-20 flex max-w-[45%] flex-col gap-1.5 ${clase}`} data-etiquetas-foto={esquina}>
            {propias.map((e) => (
              <span key={e.clave} className={claseChip(e, ctx.opciones.tamano)} style={estiloChip(e)} data-etiqueta={e.tipo}>
                <Contenido e={e} />
              </span>
            ))}
          </div>
        )
      })}
    </>
  )
}

// ── B: fila junto al título ──────────────────────────────────────────────────────────────────────

/** Fila de etiquetas bajo el SKU, sobre el título. «2 X 1» y «Precio por volumen» se tocan. */
export function FilaEtiquetasFicha() {
  const { lista, promo, ctx } = useEtiquetas('titulo')
  const [abierta, setAbierta] = useState(false)
  if (!ctx || lista.length === 0) return null

  const bajarAVolumen = () => {
    const destino = document.querySelector('[data-escalones]') ?? document.querySelector('[data-precio-volumen]')
    destino?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" data-etiquetas-titulo="">
      {lista.map((e) => {
        if (e.accion === 'promocion' && promo) {
          return (
            <span key={e.clave} className="relative">
              <button
                type="button"
                className={`${claseChip(e, ctx.opciones.tamano)} cursor-pointer`}
                style={estiloChip(e)}
                aria-expanded={abierta}
                aria-haspopup="dialog"
                onClick={() => setAbierta((a) => !a)}
                data-etiqueta={e.tipo}
              >
                <Contenido e={e} conFlecha />
              </button>
              {abierta && <ExplicacionPromocion promo={promo} etiqueta={e} ctx={ctx} onCerrar={() => setAbierta(false)} />}
            </span>
          )
        }
        if (e.accion === 'volumen') {
          return (
            <button key={e.clave} type="button" className={`${claseChip(e, ctx.opciones.tamano)} cursor-pointer`} style={estiloChip(e)} onClick={bajarAVolumen} data-etiqueta={e.tipo}>
              <Contenido e={e} conFlecha />
            </button>
          )
        }
        return (
          <span key={e.clave} className={claseChip(e, ctx.opciones.tamano)} style={estiloChip(e)} data-etiqueta={e.tipo}>
            <Contenido e={e} />
          </span>
        )
      })}
    </div>
  )
}

/** Ventana (computador) u hoja desde abajo (celular) que explica la promoción real. */
function ExplicacionPromocion({ promo, etiqueta, ctx, onCerrar }: {
  promo: PromoEtiquetaTienda
  etiqueta: EtiquetaFichaPintada
  ctx: EtiquetasFichaValor
  onCerrar: () => void
}) {
  const { formatPrice } = useCurrency()
  const zona = useZonaPromos()
  const idTitulo = useId()
  const x = useMemo(() => explicarPromo(promo, ctx.producto, ctx.precio, formatPrice), [promo, ctx.producto, ctx.precio, formatPrice])
  const fin = fechaFinPromo(promo.fin, zona)

  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const llevar = () => {
    if (x.cantidad == null) return
    pedirCantidad([ctx.producto.id, ...ctx.variantes], x.cantidad)
    onCerrar()
  }
  const tono = etiqueta.bg_color && etiqueta.bg_color.startsWith('#') && etiqueta.bg_color.length === 7 ? `${etiqueta.bg_color}14` : 'rgba(239,68,68,0.08)'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-labelledby={idTitulo}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-gray-900 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80 sm:rounded-xl sm:border sm:dark:border-gray-700"
        data-explicacion-promo=""
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <p id={idTitulo} className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <span className={claseChip(etiqueta, 'sm')} style={estiloChip(etiqueta)}>{x.etiqueta}</span>
            {x.titulo}
          </p>
          <button type="button" onClick={onCerrar} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{x.texto}</p>
        {x.ejemplo && (
          <dl className="mt-3 space-y-1 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: tono }}>
            {x.ejemplo.map((l) => (
              <div key={l.etiqueta} className={`flex justify-between gap-3 ${l.tipo === 'total' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                <dt>{l.etiqueta}</dt>
                <dd style={l.tipo === 'descuento' ? { color: '#DC2626' } : undefined}>{l.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {(fin || x.notas.length > 0) && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {[fin ? `Válido hasta el ${fin}` : null, ...x.notas].filter(Boolean).join(' · ')}
          </p>
        )}
        {x.cantidad != null && x.total != null && (
          <button
            type="button"
            onClick={llevar}
            className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: ctx.primaryColor, color: textoContraste(ctx.primaryColor) }}
          >
            Llevar {x.cantidad} · {formatPrice(x.total)}
          </button>
        )}
      </div>
    </>
  )
}
