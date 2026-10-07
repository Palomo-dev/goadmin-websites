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
