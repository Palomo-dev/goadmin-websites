/**
 * Costo de envío de un pedido web, calculado en el servidor.
 *
 * Una sola implementación para `/api/shipping/calculate` (lo que el checkout muestra) y
 * `/api/orders` (lo que se cobra):
 * - `tarifasParaDestino` + `calcularTarifas`: tarifas de `shipping_rates` vigentes, visibles en la
 *   web y aplicables a la ciudad (o genéricas), con peso, recargo, cargo mínimo y envío gratis.
 * - `resolverEnvio`: lo que debería cobrarse por un pedido. Recoger o comer aquí = 0. Con el id de
 *   tarifa elegido en el checkout → esa tarifa (de esta organización y vigente) sobre el subtotal
 *   del servidor. Sin id → tarifa plana de `website_settings` con su umbral de envío gratis.
 *   Devuelve `null` si no se puede decidir (tarifa ajena o inexistente, sin ajustes): el llamador
 *   conserva su comportamiento actual.
 */

import type { ShippingRate } from '@/types/database'

type ClienteSupabase = { from: (tabla: string) => any }

export const SELECT_TARIFAS = 'id, organization_id, rate_name, service_level, base_rate, rate_per_kg, fuel_surcharge_percent, min_charge, min_weight_kg, max_weight_kg, free_shipping_threshold, destination_city, destination_zone, valid_from, valid_until, is_active, show_on_website, transport_carriers:carrier_id(id, name)'

type FilaTarifa = Pick<ShippingRate,
  | 'id' | 'organization_id' | 'rate_name' | 'service_level' | 'base_rate' | 'rate_per_kg'
  | 'fuel_surcharge_percent' | 'min_charge' | 'min_weight_kg' | 'max_weight_kg'
  | 'free_shipping_threshold' | 'destination_city' | 'destination_zone' | 'valid_from'
  | 'valid_until' | 'is_active' | 'show_on_website'
> & { transport_carriers?: { id: string; name: string } | null }

export interface TarifaCalculada {
  id: string
  name: string
  cost: number
  originalCost: number
  service_level: string
  carrier_name: string | null
  destination_zone: string | null
  free_shipping_threshold: number
}

const ORDEN_SERVICIO: Record<string, number> = { same_day: 1, overnight: 2, express: 3, standard: 4, economy: 5 }

/** `valid_from`/`valid_until` son `date`: se comparan como días calendario, sin pasar por zona. */
function vigente(t: FilaTarifa, hoy: string): boolean {
  if (t.valid_from && t.valid_from > hoy) return false
  if (t.valid_until && t.valid_until < hoy) return false
  return true
}

/** Tarifas aplicables a la ciudad; si ninguna nombra la ciudad, las genéricas (sin ciudad). */
export function tarifasParaDestino(tarifas: FilaTarifa[], ciudad: string, peso: number | null, hoy: string): FilaTarifa[] {
  const ciudadNorm = (ciudad || '').toLowerCase().trim()
  const validas = tarifas.filter((t) => {
    if (!vigente(t, hoy)) return false
    if (t.destination_city) {
      const destino = t.destination_city.toLowerCase().trim()
      if (destino !== ciudadNorm && ciudadNorm !== '') return false
    }
    if (peso && t.min_weight_kg && peso < Number(t.min_weight_kg)) return false
    if (peso && t.max_weight_kg && peso > Number(t.max_weight_kg)) return false
    return true
  })
  if (validas.length > 0) return validas
  return tarifas.filter((t) => vigente(t, hoy) && !t.destination_city)
}

export function calcularTarifas(tarifas: FilaTarifa[], peso?: number | null, subtotal?: number | null) {
  const calculadas: TarifaCalculada[] = tarifas.map((t) => {
    let costo = Number(t.base_rate || 0)
    if (peso && t.rate_per_kg) costo += Number(peso) * Number(t.rate_per_kg)
    if (t.fuel_surcharge_percent) costo += (costo * Number(t.fuel_surcharge_percent)) / 100
    if (t.min_charge && costo < Number(t.min_charge)) costo = Number(t.min_charge)
    costo = Math.round(costo)
    const umbral = Number(t.free_shipping_threshold || 0)
    const gratis = umbral > 0 && !!subtotal && subtotal >= umbral
    return {
      id: t.id,
      name: t.rate_name,
      cost: gratis ? 0 : costo,
      originalCost: costo,
      service_level: t.service_level || 'standard',
      carrier_name: t.transport_carriers?.name || null,
      destination_zone: t.destination_zone,
      free_shipping_threshold: umbral,
    }
  })
  calculadas.sort((a, b) => a.cost - b.cost)
  const cheapest = calculadas[0] || null
  const fastest = [...calculadas].sort(
    (a, b) => (ORDEN_SERVICIO[a.service_level] || 99) - (ORDEN_SERVICIO[b.service_level] || 99),
  )[0] || null
  return { rates: calculadas, cheapest, fastest }
}

export async function leerTarifasWeb(supabase: ClienteSupabase, organizationId: number): Promise<FilaTarifa[] | null> {
  const { data, error } = await supabase
    .from('shipping_rates')
    .select(SELECT_TARIFAS)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('show_on_website', true)
  if (error) {
    console.error('[Envío] No se pudieron leer las tarifas', { organizationId, error: error.message })
    return null
  }
  return (data || []) as FilaTarifa[]
}

export interface AjustesEnvio {
  enableShipping: boolean
  tarifaPlana: number
  umbralGratis: number
}

export type EnvioResuelto =
  | { costo: number; fuente: 'sin_envio' | 'tarifa' | 'plana' | 'desactivado'; tarifaId: string | null }
  | null

export interface EntradaResolverEnvio {
  organizationId: number
  esDomicilio: boolean
  tarifaId: string | null
  ciudad: string
  subtotal: number
  /** `website_settings` de la organización; `null` si no hay fila. */
  ajustes: AjustesEnvio | null
  /** YYYY-MM-DD de hoy en la zona de la organización (vigencia de tarifas). */
  hoy: string
}

export async function resolverEnvio(supabase: ClienteSupabase, e: EntradaResolverEnvio): Promise<EnvioResuelto> {
  if (!e.esDomicilio) return { costo: 0, fuente: 'sin_envio', tarifaId: null }
  if (e.tarifaId) {
    const tarifas = await leerTarifasWeb(supabase, e.organizationId)
    if (!tarifas) return null
    const tarifa = tarifas.find((t) => t.id === e.tarifaId)
    if (!tarifa) return null
    const aplicables = tarifasParaDestino(tarifas, e.ciudad, null, e.hoy)
    if (!aplicables.some((t) => t.id === tarifa.id)) return null
    const { rates } = calcularTarifas([tarifa], null, e.subtotal)
    return { costo: rates[0].cost, fuente: 'tarifa', tarifaId: tarifa.id }
  }
  if (!e.ajustes) return null
  if (!e.ajustes.enableShipping) return { costo: 0, fuente: 'desactivado', tarifaId: null }
  const gratis = e.ajustes.umbralGratis > 0 && e.subtotal >= e.ajustes.umbralGratis
  return { costo: gratis ? 0 : e.ajustes.tarifaPlana, fuente: 'plana', tarifaId: null }
}
