import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'

/**
 * Contador regresivo «clásico»: las columnas `countdown_*` / `checkout_show_countdown` de
 * `website_settings` que escriben el editor viejo y el nuevo (Estilo del sitio › Contador regresivo).
 * Solo esas columnas viajan al cliente.
 */
export const COLUMNAS_CONTADOR = [
  'countdown_enabled', 'countdown_title', 'countdown_mode', 'countdown_end_date', 'countdown_timezone',
  'countdown_reset_hour', 'countdown_show_in_header', 'countdown_show_in_cart', 'countdown_show_in_product',
  'countdown_show_in_hero', 'checkout_show_countdown',
] as const

export type ColumnaUbicacionContador =
  | 'countdown_show_in_header'
  | 'countdown_show_in_cart'
  | 'countdown_show_in_product'
  | 'countdown_show_in_hero'
  | 'checkout_show_countdown'

export function soloContador(settings: unknown): Record<string, unknown> {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>
  const r: Record<string, unknown> = {}
  for (const c of COLUMNAS_CONTADOR) if (c in s) r[c] = s[c]
  return r
}

/** Se ve en esa ubicación: contador activo y la ubicación marcada (como siempre). */
export function contadorEn(settings: Record<string, unknown> | null | undefined, columna: ColumnaUbicacionContador): boolean {
  return settings?.countdown_enabled === true && settings?.[columna] === true
}

/** Zona válida para Intl; si no lo es (o falta), la zona por defecto del sitio (Bogotá), nunca la del visitante. */
export function zonaContador(zona: unknown): string {
  if (typeof zona === 'string' && zona.trim()) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zona.trim() })
      return zona.trim()
    } catch {
      /* zona inválida */
    }
  }
  return ZONA_POR_DEFECTO
}

/** Fecha y hora de pared en `zona` (hourCycle h23: la medianoche es 00, nunca 24). */
export function partesEnZona(instante: Date, zona: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instante)
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0)
  return { y: v('year'), mo: v('month'), d: v('day'), h: v('hour') % 24, mi: v('minute'), s: v('second') }
}

/**
 * Fin «AAAA-MM-DDTHH:mm[:ss]» sin desfase (lo que guarda el `datetime-local` del editor) se lee en
 * `zona` (inválida → Bogotá); con Z o desfase, tal cual. `null` si no es una fecha.
 */
export function instanteFin(fin: string, zona: string | undefined): Date | null {
  const texto = (fin ?? '').trim()
  if (!texto) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(texto)
  if (!m) {
    const d = new Date(texto)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const tz = zonaContador(zona)
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? '23', m[5] ?? '59', m[6] ?? '00'].map(Number)
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  const desfase = (utc: number): number => {
    const q = partesEnZona(new Date(utc), tz)
    return Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi, q.s) - utc
  }
  const d1 = desfase(comoUtc)
  const d2 = desfase(comoUtc - d1)
  return new Date(comoUtc - d2)
}

/** Próximo reinicio diario a `hora` (0–23) en `zona`, estrictamente después de `ahora`. */
export function proximoReinicio(ahora: Date, zona: string | undefined, hora: number | null | undefined): Date | null {
  const tz = zonaContador(zona)
  const h = Number.isInteger(hora) && (hora as number) >= 0 && (hora as number) <= 23 ? (hora as number) : 0
  const hoy = partesEnZona(ahora, tz)
  const dia = (desplazo: number) => {
    const f = new Date(Date.UTC(hoy.y, hoy.mo - 1, hoy.d + desplazo))
    return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`
  }
  const deHoy = instanteFin(dia(0), tz)
  if (deHoy && deHoy.getTime() > ahora.getTime()) return deHoy
  return instanteFin(dia(1), tz)
}
