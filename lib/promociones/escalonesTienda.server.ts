/**
 * Escalones de precio por volumen de la tienda, del servidor (ver `escalonesTienda.ts`).
 *
 * Una lectura por organización: `promotions` web activas y ya empezadas de tipo `volume_tiers`
 * con sus `promotion_rules` y `promotion_tiers` (un solo select con embeds). La guardan:
 *  - `unstable_cache` del catálogo (`cacheCatalog`, 30 s y la etiqueta `catalogo-<id>`): en una
 *    ráfaga de visitas la base no ve ni una consulta más; un cambio de promoción tarda hasta 30 s
 *    en verse en la ficha (el cobro no: /api/orders siempre lee la base).
 *  - `react.cache`: una vez por render aunque la pidan el layout y la página.
 * La vigencia (horario, fin, sede, usos) se filtra en cada petición sobre las filas cacheadas,
 * con la hora de ahora: lo cacheado son filas, no la decisión.
 *
 * Sede: la del pedido web (`sedeDePedidoWeb`, la misma de /api/promotions/check): el outlet si
 * lo hay; si no, la sede por defecto de las sucursales ya cacheadas (`getOrganizationBranches`).
 * Cliente: ninguno (la página no lo tiene): las promociones «solo para el grupo …» quedan
 * marcadas sin escalones (`requiereCliente`).
 *
 * Columnas verificadas por MCP (taqjemqjtumhwptchcxk) el 2026-11-24: promotions (organization_id,
 * promotion_type, is_active, applies_to_web, start_date, end_date, … tiers_count_mode,
 * customer_segment_id, usage_limit_per_customer), promotion_rules (rule_type, product_id,
 * category_id, brand, tier_group), promotion_tiers (min_quantity, unit_price, discount_percent,
 * sort_order).
 *
 * Service role (sin RLS): `organizationId` sale del contexto del host, nunca del cliente.
 */
import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheCatalog } from '@/lib/supabase/cache'
import { getOrganizationBranches } from '@/lib/supabase/queries'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import type { PromotionRow } from '@/lib/promotions'
import { prepararEscalonesTienda, type PromoEscalonesTienda } from './escalonesTienda'

export const SELECT_PROMOS_VOLUMEN =
  'id, name, description, promotion_type, discount_value, buy_quantity, get_quantity, min_purchase_amount, max_discount_amount, applies_to, start_date, end_date, is_active, usage_limit, usage_count, is_combinable, priority, created_at, branches, applies_to_web, payment_method_codes, applicable_days, start_time, end_time, schedule_windows, tiers_count_mode, customer_segment_id, usage_limit_per_customer, promotion_rules(rule_type, product_id, category_id, brand, tier_group), promotion_tiers(min_quantity, unit_price, discount_percent, sort_order)'

async function leerPromosVolumenUncached(organizationId: number): Promise<PromotionRow[]> {
  const supabase = createAdminClient() || createPublicClient()
  const { data, error } = await (supabase as any)
    .from('promotions')
    .select(SELECT_PROMOS_VOLUMEN)
    .eq('organization_id', organizationId)
    .eq('promotion_type', 'volume_tiers')
    .eq('is_active', true)
    .eq('applies_to_web', true)
    .lte('start_date', new Date().toISOString())
  // Lanzar para que unstable_cache NO guarde el fallo; quien llama pinta la ficha sin escalones.
  if (error) throw new Error(`[Escalones] ${error.message}`)
  return (data ?? []) as PromotionRow[]
}

const leerPromosVolumen = cacheCatalog('leerPromosVolumen', leerPromosVolumenUncached, (organizationId) => organizationId)

/**
 * Promociones por volumen vigentes ahora para pintar (ficha y tarjetas). `[]` si no hay o si la
 * lectura falla: la tienda se ve como siempre.
 */
export const getEscalonesTienda = cache(async (
  organizationId: number,
  outletBranchId: number | null,
  timeZone: string | null,
): Promise<PromoEscalonesTienda[]> => {
  if (!Number.isInteger(organizationId) || organizationId <= 0) return []
  try {
    const filas = await leerPromosVolumen(organizationId)
    if (filas.length === 0) return []
    // Las sucursales solo hacen falta si alguna promoción está limitada a sedes.
    const conSedes = filas.some((p) => Array.isArray(p.branches) && p.branches.length > 0)
    const sede = conSedes
      ? sedeDePedidoWeb((await getOrganizationBranches(organizationId)) as Array<{ id: number; is_main?: boolean | null; is_web_stock_source?: boolean | null; is_active?: boolean | null }>, { outletId: outletBranchId })
      : outletBranchId
    return prepararEscalonesTienda(filas, { branchId: sede, timeZone: timeZone || undefined })
  } catch (error) {
    console.error('[Escalones] No se pudieron leer las promociones por volumen; la tienda sigue sin escalones', {
      organizationId, error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
})
