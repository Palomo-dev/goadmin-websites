/**
 * Promociones con etiqueta de la tienda («2 X 1», «−20 %», «Combo»), del servidor (ver
 * `etiquetasPromocion.ts`).
 *
 * Una lectura por organización, como el precio por volumen (`escalonesTienda.server.ts`):
 * `promotions` web activas y ya empezadas de los tipos con etiqueta, con sus `promotion_rules`
 * (un solo select con embed). La guardan la caché del catálogo (`cacheCatalog`, 30 s y la etiqueta
 * `catalogo-<id>`) y `react.cache`. Las tarjetas de los listados y la ficha resuelven la etiqueta
 * de cada producto en memoria: ninguna consulta por producto. La vigencia (horario, fin, sede,
 * usos) se filtra en cada petición sobre las filas cacheadas, con la hora de ahora.
 *
 * Grupo de clientes: las promociones que lo exigen NO viajan a todos los navegadores
 * (`separarPublicas`); el navegador con sesión las pide a /api/promotions/etiquetas, que verifica
 * el grupo con la sesión (`getEtiquetasPromoCliente`).
 *
 * Columnas verificadas por MCP (taqjemqjtumhwptchcxk) el 2026-11-24: promotions (… bundle_price,
 * min_quantity, repeat_every_quantity, min_purchase_scope, customer_segment_id,
 * usage_limit_per_customer), promotion_rules (rule_type, product_id, category_id, brand,
 * tier_group, quantity), segment_members (organization_id, segment_id, customer_id),
 * promotion_customer_uses (organization_id, customer_id, promotion_id, uses).
 *
 * Service role (sin RLS): `organizationId` sale del contexto del host, nunca del cliente.
 */
import { cache } from 'react'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { cacheCatalog } from '@/lib/supabase/cache'
import { getOrganizationBranches } from '@/lib/supabase/queries'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import { cargarClienteSesion, type PromotionRow } from '@/lib/promotions'
import { promocionRequiereCliente } from './precioVolumen'
import { TIPOS_PROMO_ETIQUETA, prepararEtiquetasPromo, separarPublicas, type PromoEtiquetaTienda } from './etiquetasPromocion'

export const SELECT_PROMOS_ETIQUETA =
  'id, name, description, promotion_type, discount_value, buy_quantity, get_quantity, min_purchase_amount, min_purchase_scope, min_quantity, repeat_every_quantity, max_discount_amount, bundle_price, applies_to, start_date, end_date, is_active, usage_limit, usage_count, is_combinable, priority, created_at, branches, applies_to_web, payment_method_codes, applicable_days, start_time, end_time, schedule_windows, customer_segment_id, usage_limit_per_customer, promotion_rules(rule_type, product_id, category_id, brand, tier_group, quantity)'

async function leerPromosEtiquetaUncached(organizationId: number): Promise<PromotionRow[]> {
  const supabase = createAdminClient() || createPublicClient()
  const { data, error } = await (supabase as any)
    .from('promotions')
    .select(SELECT_PROMOS_ETIQUETA)
    .eq('organization_id', organizationId)
    .in('promotion_type', TIPOS_PROMO_ETIQUETA as unknown as string[])
    .eq('is_active', true)
    .eq('applies_to_web', true)
    .lte('start_date', new Date().toISOString())
  // Lanzar para que unstable_cache NO guarde el fallo; quien llama pinta la tienda sin etiquetas.
  if (error) throw new Error(`[EtiquetasPromo] ${error.message}`)
  return (data ?? []) as PromotionRow[]
}

const leerPromosEtiqueta = cacheCatalog('leerPromosEtiqueta', leerPromosEtiquetaUncached, (organizationId) => organizationId)

async function sedeDe(organizationId: number, filas: PromotionRow[], outletBranchId: number | null): Promise<number | null> {
  // Las sucursales solo hacen falta si alguna promoción está limitada a sedes.
  const conSedes = filas.some((p) => Array.isArray(p.branches) && p.branches.length > 0)
  if (!conSedes) return outletBranchId
  return sedeDePedidoWeb(
    (await getOrganizationBranches(organizationId)) as Array<{ id: number; is_main?: boolean | null; is_web_stock_source?: boolean | null; is_active?: boolean | null }>,
    { outletId: outletBranchId },
  )
}

export interface EtiquetasPromoTienda {
  /** Promociones para todos (sin grupo de clientes). */
  publicas: PromoEtiquetaTienda[]
  /** Hay promociones solo para un grupo de clientes: el navegador con sesión las pide aparte. */
  hayDeCliente: boolean
}

const VACIO: EtiquetasPromoTienda = { publicas: [], hayDeCliente: false }

/**
 * Promociones con etiqueta vigentes ahora, para pintar (tarjetas y ficha). Vacío si no hay o si la
 * lectura falla: la tienda se ve como siempre.
 */
export const getEtiquetasPromoTienda = cache(async (
  organizationId: number,
  outletBranchId: number | null,
  timeZone: string | null,
): Promise<EtiquetasPromoTienda> => {
  if (!Number.isInteger(organizationId) || organizationId <= 0) return VACIO
  try {
    const filas = await leerPromosEtiqueta(organizationId)
    if (filas.length === 0) return VACIO
    const sede = await sedeDe(organizationId, filas, outletBranchId)
    return separarPublicas(prepararEtiquetasPromo(filas, { branchId: sede, timeZone: timeZone || undefined }))
  } catch (error) {
    console.error('[EtiquetasPromo] No se pudieron leer las promociones; la tienda sigue sin sus etiquetas', {
      organizationId, error: error instanceof Error ? error.message : String(error),
    })
    return VACIO
  }
})

/**
 * Promociones «solo para el grupo …» (o con usos por cliente) que le aplican al cliente de la
 * SESIÓN. `customerId` sale de `getAuthCustomer` (cookie + organización del host), nunca del
 * cliente. Lee segmentos y usos solo de ese cliente y solo si hay promociones que los miran.
 */
export async function getEtiquetasPromoCliente(
  organizationId: number,
  customerId: string,
  outletBranchId: number | null,
  timeZone: string | null,
): Promise<PromoEtiquetaTienda[]> {
  const filas = (await leerPromosEtiqueta(organizationId)).filter((p) => promocionRequiereCliente(p))
  if (filas.length === 0) return []
  const supabase = createAdminClient() || createPublicClient()
  const [sede, cliente] = await Promise.all([
    sedeDe(organizationId, filas, outletBranchId),
    cargarClienteSesion(supabase, organizationId, customerId, filas),
  ])
  if (!cliente) return []
  return prepararEtiquetasPromo(filas, { branchId: sede, timeZone: timeZone || undefined, cliente })
}
