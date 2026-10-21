/**
 * Foto de una línea al retomar la compra.
 *
 * El pedido no guarda la imagen. Se toma la principal del producto y, si la
 * variante no tiene, la del padre. La URL es la misma que arma la ficha.
 */

export const BASE_IMAGEN_PRODUCTO = 'https://jgmgphmzusbluqhuqihj.supabase.co'

export interface FotoProducto {
  productId: number
  storagePath: string | null
  sharedPath: string | null
  isPrimary: boolean
  displayOrder: number
}

const UUID_PRODUCTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function uuidProducto(valor: unknown): string | null {
  if (typeof valor !== 'string' || !UUID_PRODUCTO.test(valor)) return null
  return valor.toLowerCase()
}

/** Atributos de variante tal como los pinta el carrito (`color: Beige`). */
export function atributosVariante(valor: unknown): Record<string, string> | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const salida: Record<string, string> = {}
  for (const [clave, crudo] of Object.entries(valor as Record<string, unknown>)) {
    const nombre = clave.trim()
    if (!nombre || nombre.length > 80) continue
    if (typeof crudo === 'string' && crudo.trim()) salida[nombre] = crudo.trim().slice(0, 120)
    else if (typeof crudo === 'number' && Number.isFinite(crudo)) salida[nombre] = String(crudo)
  }
  return Object.keys(salida).length > 0 ? salida : null
}

export function urlImagenProducto(path: string | null | undefined, base = BASE_IMAGEN_PRODUCTO): string | null {
  const limpio = (path || '').trim().replace(/^\/+/, '')
  if (!limpio || limpio.length > 500 || limpio.includes('..') || limpio.includes('\\') || limpio.includes('://')) return null
  const raiz = base.replace(/\/$/, '')
  return `${raiz}/storage/v1/object/public/product-images/${limpio}`
}

function rutaDe(foto: FotoProducto): string | null {
  const propia = (foto.storagePath || '').trim()
  if (propia) return propia
  const compartida = (foto.sharedPath || '').trim()
  return compartida || null
}

/** Principal, y si no hay, la de menor `display_order`. */
export function elegirRutaImagen(fotos: readonly FotoProducto[], productId: number): string | null {
  const propias = fotos.filter((f) => f.productId === productId && rutaDe(f))
  if (propias.length === 0) return null
  propias.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
    return 0
  })
  return rutaDe(propias[0])
}

export function imagenRetoma(
  fotos: readonly FotoProducto[],
  productId: number,
  parentId: number | null,
  base = BASE_IMAGEN_PRODUCTO,
): string | null {
  const propia = urlImagenProducto(elegirRutaImagen(fotos, productId), base)
  if (propia) return propia
  if (parentId == null) return null
  return urlImagenProducto(elegirRutaImagen(fotos, parentId), base)
}

/** Cuadrado gris del correo cuando el producto no tiene foto. */
export const RUTA_FOTO_AUSENTE = '/correo/sin-foto.png'

/**
 * URL absoluta https para el `<img>` del correo. La foto del producto si
 * ya es https; si no, el placeholder del propio sitio. http no entra:
 * Gmail no lo muestra.
 */
export function urlFotoEnCorreo(foto: string | null | undefined, origen: string): string | null {
  const limpia = (foto || '').trim()
  if (limpia.startsWith('https://') && !limpia.includes(' ') && limpia.length < 2000) return limpia
  const base = origen.trim().replace(/\/$/, '')
  if (!base.startsWith('https://') || base.includes(' ')) return null
  return `${base}${RUTA_FOTO_AUSENTE}`
}
