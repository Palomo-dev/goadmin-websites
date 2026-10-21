/**
 * Foto de cada línea del correo de pedido.
 *
 * El pedido no guarda la imagen. Se usa la principal del producto y, si la
 * variante no tiene, la del padre de la misma organización. Sin ninguna,
 * el correo muestra el placeholder del sitio.
 */

import {
  imagenRetoma,
  urlFotoEnCorreo,
  type FotoProducto,
} from '@/lib/orders/imagenProducto'

type ClienteFotos = { from: (tabla: string) => any }

export interface LineaCorreo {
  name: string
  quantity: number
  unitPrice: number
  total: number
  imageUrl: string | null
}

interface FilaLinea {
  product_id?: unknown
  product_name?: unknown
  quantity?: unknown
  unit_price?: unknown
  total?: unknown
}

function idEntero(valor: unknown): number | null {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

function aFotos(imagenes: unknown): FotoProducto[] {
  if (!Array.isArray(imagenes)) return []
  return imagenes.map((img) => {
    const fila = img as {
      product_id?: unknown
      storage_path?: unknown
      is_primary?: unknown
      display_order?: unknown
      shared_images?: { storage_path?: unknown } | { storage_path?: unknown }[] | null
    }
    const compartida = fila.shared_images
    const sharedPath = Array.isArray(compartida) ? compartida[0]?.storage_path : compartida?.storage_path
    return {
      productId: Number(fila.product_id),
      storagePath: typeof fila.storage_path === 'string' ? fila.storage_path : null,
      sharedPath: typeof sharedPath === 'string' ? sharedPath : null,
      isPrimary: fila.is_primary === true,
      displayOrder: Number.isFinite(Number(fila.display_order)) ? Number(fila.display_order) : 0,
    }
  })
}

/** productId → url https de la foto, o null si no hay. */
export async function fotosDeProductos(
  sb: ClienteFotos,
  organizationId: number,
  productIds: readonly number[],
): Promise<Map<number, string | null>> {
  const salida = new Map<number, string | null>()
  const ids = Array.from(new Set(productIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) return salida
  const { data: productos, error } = await sb
    .from('products')
    .select('id, parent_product_id')
    .eq('organization_id', organizationId)
    .in('id', ids)
  if (error) {
    console.error('[correo] No se pudieron leer los productos de la foto', { organizationId, error: error.message })
    return salida
  }
  const padreDe = new Map<number, number | null>()
  const padres: number[] = []
  for (const fila of (productos || []) as { id?: unknown; parent_product_id?: unknown }[]) {
    const id = idEntero(fila.id)
    if (id == null) continue
    const padre = idEntero(fila.parent_product_id)
    if (padre) padres.push(padre)
    padreDe.set(id, padre)
    salida.set(id, null)
  }
  let padresOk: number[] = []
  if (padres.length > 0) {
    const { data: filasPadre, error: errorPadre } = await sb
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .in('id', Array.from(new Set(padres)))
    if (errorPadre) {
      console.error('[correo] No se pudo leer el producto padre', { organizationId, error: errorPadre.message })
    } else {
      padresOk = ((filasPadre || []) as { id?: unknown }[])
        .map((fila) => idEntero(fila.id))
        .filter((id): id is number => id != null)
    }
  }
  const idsFoto = Array.from(new Set([...padreDe.keys(), ...padresOk]))
  if (idsFoto.length === 0) return salida
  const { data: imagenes, error: errorImagenes } = await sb
    .from('product_images')
    .select('product_id, storage_path, is_primary, display_order, shared_images(storage_path)')
    .in('product_id', idsFoto)
    .order('display_order', { ascending: true })
  if (errorImagenes) {
    console.error('[correo] No se pudieron leer las fotos', { organizationId, error: errorImagenes.message })
    return salida
  }
  const fotos = aFotos(imagenes)
  const padresValidos = new Set(padresOk)
  for (const [id, padre] of padreDe) {
    salida.set(id, imagenRetoma(fotos, id, padre != null && padresValidos.has(padre) ? padre : null))
  }
  return salida
}

const num = (valor: unknown): number => {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export async function lineasConFoto(
  sb: ClienteFotos,
  organizationId: number,
  origen: string,
  lineas: readonly FilaLinea[],
): Promise<LineaCorreo[]> {
  const ids = lineas.map((linea) => idEntero(linea.product_id)).filter((id): id is number => id != null)
  const fotos = await fotosDeProductos(sb, organizationId, ids)
  return lineas.map((linea) => {
    const id = idEntero(linea.product_id)
    const foto = id == null ? null : fotos.get(id) ?? null
    return {
      name: String(linea.product_name || ''),
      quantity: num(linea.quantity),
      unitPrice: num(linea.unit_price),
      total: num(linea.total),
      imageUrl: urlFotoEnCorreo(foto, origen),
    }
  })
}
