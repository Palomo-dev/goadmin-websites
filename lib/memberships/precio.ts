/**
 * Precio de un plan de membresía.
 *
 * Desde las fases 1–2 de Membresías del ERP (docs/design/MEMBRESIAS-FASE-1-2.md en
 * go-admin-erp) un plan es la configuración operativa de un PRODUCTO
 * (`products.service_type = 'membership'`, ligado por `membership_plans.product_id`), y el
 * precio vive SOLO en `product_prices`, con vigencia (`effective_from` / `effective_to`).
 * `membership_plans.price` quedó obsoleto y se retira en la fase 3: no se lee aquí.
 *
 * Misma regla que `preciosVigentes` del ERP (`membresias.server.ts`): el precio vigente es
 * el de `effective_from` más reciente que ya empezó y que no ha terminado.
 */

export interface PrecioProducto {
  id?: number | null
  price: number | string | null
  compare_price?: number | string | null
  effective_from: string | null
  effective_to: string | null
}

export function precioVigente(
  precios: PrecioProducto[] | null | undefined,
  ahora: Date = new Date()
): { price: number; compare_price: number | null } | null {
  if (!Array.isArray(precios) || precios.length === 0) return null
  const t = ahora.getTime()

  const vigentes = precios.filter((p) => {
    if (p.price === null || p.price === undefined) return false
    const desde = p.effective_from ? Date.parse(p.effective_from) : NaN
    if (!Number.isFinite(desde) || desde > t) return false
    if (p.effective_to) {
      const hasta = Date.parse(p.effective_to)
      if (Number.isFinite(hasta) && hasta <= t) return false
    }
    return true
  })
  if (vigentes.length === 0) return null

  vigentes.sort((a, b) => {
    const diff = Date.parse(b.effective_from as string) - Date.parse(a.effective_from as string)
    return diff !== 0 ? diff : Number(b.id ?? 0) - Number(a.id ?? 0)
  })

  const elegido = vigentes[0]
  const price = Number(elegido.price)
  if (!Number.isFinite(price)) return null
  const compare = elegido.compare_price === null || elegido.compare_price === undefined
    ? null
    : Number(elegido.compare_price)
  return { price, compare_price: Number.isFinite(compare) ? compare : null }
}
