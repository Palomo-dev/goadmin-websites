/**
 * Servicios de la sección `services_list`: forma que leen los componentes
 * (components/sections/services/*) y conversión desde las dos fuentes. Sin servidor ni base:
 * la consulta vive en `lib/website/datosSecciones.ts` y esto lo prueba
 * `scripts/verify-interruptores.mjs`.
 */

import { textoPlano } from '@/lib/texto/textoPlano'

export interface ServicioSeccion {
  id: string
  name: string
  description: string | null
  price: number | null
  /** Precio anterior real (`product_prices.compare_price`); `null` si no hay. */
  compare_price: number | null
  icon: string | null
  /** Foto del ítem guardado en el editor (`content.items`). El catálogo no la trae. */
  image_url?: string | null
  cta_text?: string | null
  cta_url?: string | null
}

export const MAX_SERVICIOS = 50

function numeroONulo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Producto de servicio (`unit_code = 'SV'`) → servicio de la sección. Pura: la prueba el verify. */
export function servicioDesdeProducto(p: {
  id: number | string
  name: string
  description?: string | null
  product_prices?: { price?: unknown; compare_price?: unknown }[] | null
}): ServicioSeccion {
  const vigente = p.product_prices?.[0]
  return {
    id: String(p.id),
    name: p.name,
    description: textoPlano(p.description) || null,
    price: numeroONulo(vigente?.price),
    compare_price: numeroONulo(vigente?.compare_price),
    icon: null,
  }
}

/** Fila de `organization_services` (con su servicio global) → servicio de la sección. */
export function servicioDesdeCatalogo(os: {
  id: string
  custom_name: string | null
  custom_icon: string | null
  price: unknown
  services: { name: string; icon: string | null } | { name: string; icon: string | null }[] | null
}): ServicioSeccion {
  const global = Array.isArray(os.services) ? os.services[0] : os.services
  return {
    id: os.id,
    name: os.custom_name || global?.name || 'Servicio',
    description: null,
    price: numeroONulo(os.price),
    compare_price: null,
    icon: os.custom_icon || global?.icon || null,
  }
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** El editor guarda cada servicio en `content.items` (título, descripción, icono, imagen, botón). */
export function itemDeEditorTieneServicio(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const o = item as Record<string, unknown>
  return Boolean(
    texto(o.title) || texto(o.name) || texto(o.label) || texto(o.description) || texto(o.icon) || texto(o.image_url) || texto(o.cta_text) || texto(o.cta_url),
  )
}

/** Ítem del repetidor del editor → la forma que pintan las variantes. */
export function servicioDesdeItemEditor(item: Record<string, unknown>, indice: number): ServicioSeccion {
  const nombre = texto(item.title) || texto(item.name) || texto(item.label) || 'Servicio'
  return {
    id: texto(item.id) || String(indice),
    name: nombre,
    description: textoPlano(texto(item.description)) || null,
    price: numeroONulo(item.price),
    compare_price: numeroONulo(item.compare_price),
    icon: texto(item.icon) || null,
    image_url: texto(item.image_url) || null,
    cta_text: texto(item.cta_text) || null,
    cta_url: texto(item.cta_url) || null,
  }
}

/**
 * Lo que pinta la sección. Si el editor guardó ítems, esos ganan: el catálogo
 * (`data.services`) es el respaldo de los sitios que no armaron la lista a mano.
 */
export function serviciosParaPintar(
  content: { items?: unknown } | null | undefined,
  catalogo: ServicioSeccion[] | null | undefined,
): ServicioSeccion[] {
  const items = Array.isArray(content?.items) ? content.items.filter(itemDeEditorTieneServicio) : []
  if (items.length > 0) {
    return items.map((item, i) => servicioDesdeItemEditor(item as Record<string, unknown>, i))
  }
  return catalogo ?? []
}
