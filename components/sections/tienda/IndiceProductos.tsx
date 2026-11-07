/**
 * Sección `product_index · list` («Índice de productos», Roble; PLANO §3).
 *
 * Lista numerada de piezas (nombre y precio) con la foto de la pieza activa al lado: al pasar el
 * mouse o al llegar con el teclado a una fila, la foto cambia. Cada fila es un enlace a la ficha.
 * Productos: los elegidos (`product_ids`, máx. 12) o, sin elección, los 6 primeros con foto del
 * listado (`PRODUCTOS_INDICE_POR_DEFECTO`). Sin productos activos no se pinta.
 *
 * La lámina dice «6 de 26 piezas» y «Envío gratis en Colombia»: lo primero exigiría un conteo
 * aparte y lo segundo sería un hecho inventado, así que no se pintan. El texto pequeño de arriba
 * es el `title` del dueño.
 *
 * Sin 'use client': el manifiesto lee `IndiceProductos.CONTENT_KEYS`. La interacción vive en
 * `IndiceProductosVista.tsx`.
 */

import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { getProductImageUrl, getProductPrice } from '@/lib/products/datosTarjeta'
import { CLAVES_SECCION_TIENDA, normalizarIndiceProductos, textoDimensiones } from '@/lib/website/v2/contrato/seccionesTienda'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { EditorHint } from '../restaurant/EditorHint'
import { IndiceProductosVista, type FilaIndice } from './IndiceProductosVista'
import { motivoSeccionTiendaVacia, nombreCategoria, productosIndice, type DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['product_index.list']

interface IndiceProductosProps {
  content: Record<string, unknown>
  primaryColor?: string
  data?: DatosPaginaTienda
}

export function IndiceProductos({ content, primaryColor = '#111111', data }: IndiceProductosProps) {
  const n = normalizarIndiceProductos(content)
  const productos = productosIndice(content, data)
  if (productos.length === 0) {
    const vacia = motivoSeccionTiendaVacia('product_index', 'list', content, data)
    return vacia ? <EditorHint title={vacia.titulo}>{vacia.texto}</EditorHint> : null
  }
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''
  const filas: FilaIndice[] = productos.map((p) => ({
    id: Number(p.id),
    nombre: String(p.name ?? ''),
    href: conPrefijo(`/productos/${p.uuid ?? p.id}`, prefijo),
    precio: n.showPrice ? getProductPrice(p) : null,
    foto: getProductImageUrl(p),
    detalle: [nombreCategoria(data, p), textoDimensiones(p.length_cm, p.width_cm, p.height_cm)].filter(Boolean).join(' · '),
  }))
  const cta = n.ctaText ? { texto: n.ctaText, href: conPrefijo(n.ctaUrl, prefijo) } : null

  return (
    <IndiceProductosVista
      titulo={n.title}
      filas={filas}
      cta={cta}
      colorBoton={{ fondo: primaryColor, texto: textoSobreAcentoSiHex(primaryColor) ?? '#FFFFFF' }}
    />
  )
}

IndiceProductos.CONTENT_KEYS = CONTENT_KEYS
