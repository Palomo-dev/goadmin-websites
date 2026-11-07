/**
 * Sección `shop_the_look · hotspots` («Compra el look», Hogar; PLANO §3).
 *
 * Una foto del espacio con puntos sobre los productos reales que aparecen en ella. Cada punto
 * abre una etiqueta con el nombre, el precio y el enlace a la ficha. Debajo («Todo en este
 * espacio», `show_cards`), las tarjetas de esos productos con el `ProductCard` de siempre: agregar
 * al carrito es su carrito interno (`addProductToCart` de lib/cart), sin una segunda escritura.
 * Los productos padre mandan a elegir la variante, como en cualquier tarjeta.
 *
 * Sin foto, sin puntos o sin ningún producto activo detrás de los puntos no se pinta
 * (`compraElLookVisible` + `puntosLook`). «Comprar todo el espacio» de la lámina no está en el
 * contrato de esta sección y no se pinta.
 *
 * Sin 'use client': el manifiesto lee `CompraElLook.CONTENT_KEYS`. La interacción vive en
 * `CompraElLookVista.tsx`.
 */

import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { getProductPrice } from '@/lib/products/datosTarjeta'
import { CLAVES_SECCION_TIENDA, compraElLookVisible, normalizarCompraElLook } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { CompraElLookVista, type PuntoVista } from './CompraElLookVista'
import { motivoSeccionTiendaVacia, puntosLook, type DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['shop_the_look.hotspots']

interface CompraElLookProps {
  content: Record<string, unknown>
  primaryColor?: string
  organization?: { subdomain?: string | null }
  data?: DatosPaginaTienda
}

export function CompraElLook({ content, primaryColor = '#111111', organization, data }: CompraElLookProps) {
  const l = normalizarCompraElLook(content)
  const puntos = compraElLookVisible(l) ? puntosLook(content, data) : []
  if (puntos.length === 0) {
    const vacia = motivoSeccionTiendaVacia('shop_the_look', 'hotspots', content, data)
    return vacia ? <EditorHint title={vacia.titulo}>{vacia.texto}</EditorHint> : null
  }
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''
  const vista: PuntoVista[] = puntos.map((p) => ({
    x: p.x,
    y: p.y,
    nombre: p.label || String(p.producto.name ?? ''),
    precio: getProductPrice(p.producto),
    href: conPrefijo(`/productos/${p.producto.uuid ?? p.producto.id}`, prefijo),
  }))
  // Tarjetas: un producto una vez, en el orden de los puntos.
  const productos = puntos.map((p) => p.producto).filter((p, i, todos) => todos.findIndex((q) => q.id === p.id) === i)

  return (
    <CompraElLookVista
      titulo={l.title}
      imagen={l.imageUrl}
      puntos={vista}
      productos={l.showCards ? productos : []}
      content={content}
      primaryColor={primaryColor}
      subdominio={organization?.subdomain ?? ''}
      branchId={typeof data?.branchId === 'number' ? data.branchId : null}
    />
  )
}

CompraElLook.CONTENT_KEYS = CONTENT_KEYS
