/**
 * Duración y periodo de un plan de membresía para mostrar en el sitio
 * («/mes», «/3 meses», «1 año»). Puro: lo usan la página de planes
 * (MembershipPlans, cliente) y la sección `membership_plans` (servidor).
 */

export interface PlanConDuracion {
  duration_days: number
  duration_unit?: string | null
  duration_value?: number | null
  frequency?: string | null
}

const UNIDADES: Record<string, [string, string]> = {
  day: ['día', 'días'],
  week: ['semana', 'semanas'],
  month: ['mes', 'meses'],
  year: ['año', 'años'],
}

/** Sufijo del precio a partir de la duración del plan (`duration_unit`/`duration_value`). */
export function formatPeriodo(plan: PlanConDuracion): string {
  const unidad = plan.duration_unit ? UNIDADES[plan.duration_unit] : undefined
  const valor = plan.duration_value ?? null
  if (unidad && valor && valor > 0) {
    return valor === 1 ? `/${unidad[0]}` : `/${valor} ${unidad[1]}`
  }
  return formatFrequency(plan.frequency ?? undefined)
}

function formatFrequency(frequency?: string): string {
  switch (frequency) {
    case 'monthly': return '/mes'
    case 'quarterly': return '/trimestre'
    case 'semiannual': return '/semestre'
    case 'biannual': return '/semestre'
    case 'annual': return '/año'
    case 'daily': return '/día'
    case 'weekly': return '/semana'
    default: return '/mes'
  }
}

function formatDuration(days: number): string {
  if (days === 1) return '1 día'
  if (days === 7) return '1 semana'
  if (days === 30 || days === 31) return '1 mes'
  if (days === 90) return '3 meses'
  if (days === 180) return '6 meses'
  if (days === 365 || days === 366) return '1 año'
  return `${days} días`
}

export function formatDuracionPlan(plan: PlanConDuracion): string {
  const unidad = plan.duration_unit ? UNIDADES[plan.duration_unit] : undefined
  const valor = plan.duration_value ?? null
  if (unidad && valor && valor > 0) return `${valor} ${valor === 1 ? unidad[0] : unidad[1]}`
  return formatDuration(plan.duration_days)
}
