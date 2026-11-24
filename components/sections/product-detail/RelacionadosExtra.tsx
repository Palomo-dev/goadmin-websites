'use client'

/**
 * Productos relacionados de la ficha, estilos nuevos (Figma «16 Sitio web» 2988:73769):
 * - C · Lista compacta: filas con foto pequeña, nombre, precio y «Agregar»; 2 columnas en escritorio.
 * - D · Comprados juntos: el producto de la ficha + hasta 3 más, con casillas, la suma y
 *   «Agregar los N al carrito».
 *
 * Carrito: la API de siempre del cliente (`addProductToCart`, la misma línea, la misma clave y el
 * mismo evento `cart-updated` que las tarjetas). Solo productos simples con precio: un padre con
 * variantes lleva a su ficha para elegir.
 */

import { useMemo, useState } from 'react'
import Link from '@/components/site/Enlace'
import { Check, Package, Plus, ShoppingCart } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { addProductToCart } from '@/lib/cart'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { getImageUrl } from '@/components/site/RelatedProducts'
import { sumaPrecios } from '@/lib/website/v2/seccionesFicha'
import { textoSobreAcento } from '@/lib/website/v2/textoSobreAcento'

function precioDe(p: any): number | null {
  const v = Number(p?.product_prices?.[0]?.price)
  return Number.isFinite(v) && v > 0 ? v : null
}

function precioAnteriorDe(p: any): number | null {
  const v = Number(p?.product_prices?.[0]?.compare_price)
  return Number.isFinite(v) && v > 0 ? v : null
}

function subdominio(org?: string): string {
  return org || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '')
}

function sePuedeAgregar(p: any): boolean {
  return !p?.is_parent && precioDe(p) !== null
}

function agregar(p: any, org: string | undefined, branchId: number | null | undefined) {
  const precio = precioDe(p)
  if (precio === null) return
  addProductToCart(subdominio(org), branchId, {
    id: Number(p.id),
    name: p.name,
    price: precio,
    sku: p.sku ?? null,
    imageUrl: getImageUrl(p),
    comparePrice: precioAnteriorDe(p),
  })
}

interface Comunes {
  titulo: string
  alineacionTitulo: 'izquierda' | 'centro'
  primaryColor: string
  organizationSubdomain?: string
  branchId?: number | null
}

function Titulo({ titulo, alineacion }: { titulo: string; alineacion: 'izquierda' | 'centro' }) {
  return <h2 className={`mb-6 text-2xl font-bold text-gray-900 dark:text-white ${alineacion === 'centro' ? 'text-center' : ''}`}>{titulo}</h2>
}

function Miniatura({ p, clase }: { p: any; clase: string }) {
  const url = getImageUrl(p)
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- miniatura desde storage público
    <img src={url} alt="" className={`${clase} object-cover`} loading="lazy" />
  ) : (
    <span className={`${clase} flex items-center justify-center bg-gray-100 text-gray-400 dark:bg-gray-800`}>
      <Package className="h-5 w-5" aria-hidden="true" />
    </span>
  )
}

// ─── C · Lista compacta ──────────────────────────────────────────────────────────────────

export function ListaCompactaRelacionados({ productos, ...c }: Comunes & { productos: any[] }) {
  const { ruta } = useRutaSitio()
  const [agregados, setAgregados] = useState<Set<number>>(new Set())
  if (productos.length === 0) return null
  const textoBoton = textoSobreAcento(c.primaryColor.startsWith('#') ? c.primaryColor : '#3B82F6')
  return (
    <div className="mt-16 border-t pt-12" data-relacionados="lista">
      <Titulo titulo={c.titulo} alineacion={c.alineacionTitulo} />
      <ul className="grid gap-3 md:grid-cols-2">
        {productos.map((p) => {
          const href = ruta(`/productos/${p.uuid}`)
          const listo = agregados.has(Number(p.id))
          const precio = precioDe(p)
          const anterior = precioAnteriorDe(p)
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2 pr-3 dark:border-gray-700">
              <Link href={href} className="shrink-0" tabIndex={-1} aria-hidden="true">
                <Miniatura p={p} clase="h-14 w-14 rounded-lg" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={href} className="line-clamp-1 text-sm font-medium text-gray-900 hover:underline dark:text-white">{p.name}</Link>
                <p className="flex items-baseline gap-2 text-sm">
                  {precio !== null && <Price value={precio} className="font-semibold text-gray-900 dark:text-white" />}
                  {anterior !== null && precio !== null && anterior > precio && <Price value={anterior} className="text-xs text-gray-400 line-through" />}
                </p>
              </div>
              {sePuedeAgregar(p) ? (
                <button
                  type="button"
                  onClick={() => {
                    agregar(p, c.organizationSubdomain, c.branchId)
                    setAgregados((s) => new Set(s).add(Number(p.id)))
                    setTimeout(() => setAgregados((s) => { const n = new Set(s); n.delete(Number(p.id)); return n }), 1500)
                  }}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold"
                  style={{ backgroundColor: c.primaryColor, color: textoBoton }}
                >
                  {listo ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
                  {listo ? 'Listo' : 'Agregar'}
                </button>
              ) : (
                <Link href={href} className="inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-xs font-semibold" style={{ borderColor: c.primaryColor, color: c.primaryColor }}>
                  Elegir
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── D · Comprados juntos ────────────────────────────────────────────────────────────────

export function CompradosJuntos({
  producto,
  precioProducto,
  otros,
  cajaTotal,
  ...c
}: Comunes & { producto: any; precioProducto: number | null; otros: any[]; cajaTotal: 'suave' | 'borde' }) {
  const { ruta } = useRutaSitio()
  // El de la ficha entra si es simple y tiene precio; los demás, solo los que se pueden agregar.
  const incluyeEste = sePuedeAgregar({ ...producto, product_prices: [{ price: precioProducto }] })
  const piezas = useMemo(
    () => [
      ...(incluyeEste ? [{ p: producto, precio: precioProducto, este: true }] : []),
      ...otros.filter(sePuedeAgregar).map((p) => ({ p, precio: precioDe(p), este: false })),
    ],
    [incluyeEste, producto, precioProducto, otros],
  )
  const [quitados, setQuitados] = useState<Set<string>>(new Set())
  const [listo, setListo] = useState(false)
  if (piezas.length < 2) return null
  const elegidas = piezas.filter((x) => !quitados.has(String(x.p.id)))
  const total = sumaPrecios(elegidas.map((x) => x.precio))
  const textoBoton = textoSobreAcento(c.primaryColor.startsWith('#') ? c.primaryColor : '#3B82F6')

  const agregarTodas = () => {
    for (const x of elegidas) {
      agregar(x.este ? { ...x.p, product_prices: [{ price: x.precio, compare_price: precioAnteriorDe(x.p) }] } : x.p, c.organizationSubdomain, c.branchId)
    }
    setListo(true)
    setTimeout(() => setListo(false), 1800)
  }

  return (
    <div className="mt-16 border-t pt-12" data-relacionados="juntos">
      <Titulo titulo={c.titulo} alineacion={c.alineacionTitulo} />
      <div className="flex flex-col gap-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700 lg:flex-row lg:items-center lg:p-6">
        <ul className="grid min-w-0 flex-1 grid-cols-2 gap-4 sm:flex sm:items-start">
          {piezas.map((x, i) => {
            const id = String(x.p.id)
            const marcado = !quitados.has(id)
            return (
              <li key={id} className="flex min-w-0 items-start gap-3 sm:flex-1">
                {i > 0 && (
                  <span aria-hidden="true" className="mt-12 hidden h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-500 sm:flex">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                )}
                <label className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2">
                  {x.este ? (
                    <Miniatura p={x.p} clase="aspect-square w-full rounded-lg" />
                  ) : (
                    <Link href={ruta(`/productos/${x.p.uuid}`)} tabIndex={-1} aria-hidden="true">
                      <Miniatura p={x.p} clase="aspect-square w-full rounded-lg" />
                    </Link>
                  )}
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() =>
                        setQuitados((s) => {
                          const n = new Set(s)
                          if (n.has(id)) n.delete(id)
                          else n.add(id)
                          return n
                        })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 rounded"
                      style={{ accentColor: c.primaryColor }}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="line-clamp-2 text-gray-900 dark:text-white">{x.este ? `Este producto: ${x.p.name}` : x.p.name}</span>
                      {x.precio !== null && <Price value={x.precio} className="block font-semibold text-gray-900 dark:text-white" />}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <div className={`flex shrink-0 flex-col gap-3 rounded-xl p-4 lg:w-64 ${cajaTotal === 'borde' ? 'border border-gray-200 dark:border-gray-700' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
          <p className="text-sm text-gray-600 dark:text-gray-300">Precio por {elegidas.length === 1 ? 'el producto' : `los ${elegidas.length}`}</p>
          <Price value={total} className="text-2xl font-bold text-gray-900 dark:text-white" />
          <button
            type="button"
            disabled={elegidas.length === 0}
            onClick={agregarTodas}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: c.primaryColor, color: textoBoton }}
          >
            {listo ? <Check className="h-4 w-4" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
            {listo ? 'Agregados al carrito' : elegidas.length === 1 ? 'Agregar al carrito' : `Agregar los ${elegidas.length} al carrito`}
          </button>
          <p className="text-xs text-gray-500">Quita la ✓ de lo que no quieras: el total se actualiza.</p>
        </div>
      </div>
    </div>
  )
}
