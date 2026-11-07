/**
 * Sección `product_anatomy · default` («Anatomía del producto», Roble; PLANO §3).
 *
 * Una pieza de cerca: la foto del producto elegido y hasta 3 detalles numerados que escribe el
 * dueño, con el nombre, las medidas reales (`length_cm × width_cm × height_cm`), el precio y
 * «Ver pieza». Sin producto activo o sin detalles no se pinta (`anatomiaVisible`).
 *
 * Datos: el producto sale de `data.productosTienda` (lib/queries/tienda/productosPorId.ts) o del
 * listado ya precargado. Nada se consulta desde aquí. Sin título propio, el título es el nombre
 * del producto (un dato real, no un texto inventado).
 *
 * Sin 'use client': el manifiesto lee `AnatomiaProducto.CONTENT_KEYS`.
 */

import { Price } from '@/components/site/CurrencyProvider'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { getProductImageUrl, getProductPrice } from '@/lib/products/datosTarjeta'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { anatomiaVisible, CLAVES_SECCION_TIENDA, normalizarAnatomiaProducto, textoDimensiones } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { buscarProducto, motivoSeccionTiendaVacia, type DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['product_anatomy.default']

interface AnatomiaProductoProps {
  content: Record<string, unknown>
  primaryColor?: string
  data?: DatosPaginaTienda
}

export function AnatomiaProducto({ content, primaryColor = '#111111', data }: AnatomiaProductoProps) {
  const a = normalizarAnatomiaProducto(content)
  const producto = anatomiaVisible(a) ? buscarProducto(data, a.productId) : null
  if (!producto) {
    const vacia = motivoSeccionTiendaVacia('product_anatomy', 'default', content, data)
    return vacia ? <EditorHint title={vacia.titulo}>{vacia.texto}</EditorHint> : null
  }
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''
  const href = conPrefijo(`/productos/${producto.uuid ?? producto.id}`, prefijo)
  const foto = getProductImageUrl(producto)
  const precio = getProductPrice(producto)
  const medidas = textoDimensiones(producto.length_cm, producto.width_cm, producto.height_cm)
  const titulo = a.title || String(producto.name ?? '')

  return (
    <article className="grid gap-8 md:grid-cols-2 md:gap-14">
      <div className="aspect-[4/5] overflow-hidden bg-black/5" style={{ borderRadius: 'var(--radio-sitio, 0px)' }}>
        {foto && <img src={foto} alt={String(producto.name ?? '')} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-col">
        {titulo && (
          <h2 className="titulo-legado whitespace-pre-line text-3xl leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
            {titulo}
          </h2>
        )}
        <ol className="mt-8 border-t" style={{ borderColor: 'color-mix(in srgb, currentColor 15%, transparent)' }}>
          {a.details.map((d, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr] gap-2 border-b py-4" style={{ borderColor: 'color-mix(in srgb, currentColor 15%, transparent)' }}>
              <span className="text-xs tabular-nums opacity-60" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                {d.title && <h3 className="text-base">{d.title}</h3>}
                {d.text && <p className="mt-1 text-sm leading-relaxed opacity-75">{d.text}</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-b pb-4 pt-10" style={{ borderColor: 'color-mix(in srgb, currentColor 30%, transparent)' }}>
          <div className="min-w-0">
            <p className="text-sm">{producto.name}</p>
            {medidas && <p className="text-xs opacity-60">{medidas}</p>}
          </div>
          <div className="flex items-center gap-4">
            {precio !== null && <Price value={precio} className="text-sm tabular-nums" />}
            <a
              href={href}
              className="inline-flex min-h-[40px] items-center px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: primaryColor, color: textoSobreAcentoSiHex(primaryColor) ?? '#FFFFFF', borderRadius: 'var(--radio-boton, 0px)', outlineColor: primaryColor }}
              aria-label={`Ver pieza: ${producto.name}`}
            >
              Ver pieza
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

AnatomiaProducto.CONTENT_KEYS = CONTENT_KEYS
