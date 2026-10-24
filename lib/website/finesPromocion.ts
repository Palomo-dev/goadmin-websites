/**
 * Fin de una promoción para el contador. Solo filas de la organización,
 * activas y con `applies_to_web`. Si no cumple, el fin es null y el
 * contador aplica su acción al terminar.
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { ConversionSitio } from '@/lib/website/conversion'

export function idsPromocion(conversion: ConversionSitio | null | undefined): string[] {
  if (!conversion) return []
  return conversion.contadores
    .filter((c) => c.modo.tipo === 'promocion')
    .map((c) => (c.modo.tipo === 'promocion' ? c.modo.promotionId : ''))
    .filter(Boolean)
}

export function finCombinado(endDate: string, endTime: string | null, zona: string): string | null {
  const fecha = new Date(endDate)
  if (Number.isNaN(fecha.getTime())) return null
  if (!endTime) return fecha.toISOString()
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha)
  const candidato = new Date(`${dia}T${endTime}`)
  return Number.isNaN(candidato.getTime()) ? fecha.toISOString() : candidato.toISOString()
}

export async function finesPromocion(organizationId: number, ids: string[], zona = 'America/Bogota'): Promise<Record<string, string | null>> {
  const unicos = [...new Set(ids)]
  const salida: Record<string, string | null> = {}
  for (const id of unicos) salida[id] = null
  if (!unicos.length) return salida
  const supabase = createAdminClient()
  if (!supabase) return salida
  const { data, error } = await supabase
    .from('promotions')
    .select('id, end_date, end_time, is_active, applies_to_web')
    .eq('organization_id', organizationId)
    .in('id', unicos)
  if (error || !data) return salida
  for (const fila of data as { id: string; end_date: string | null; end_time: string | null; is_active: boolean | null; applies_to_web: boolean | null }[]) {
    if (!fila.is_active || !fila.applies_to_web || !fila.end_date) continue
    salida[fila.id] = finCombinado(fila.end_date, fila.end_time, zona)
  }
  return salida
}
