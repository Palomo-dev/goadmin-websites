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

/**
 * Fin «AAAA-MM-DDTHH:mm[:ss]» sin desfase (lo que guarda el `datetime-local` del editor) se lee en
 * `zona`; con Z o desfase, tal cual. `null` si no es una fecha.
 */
export function instanteFin(fin: string, zona: string | undefined): Date | null {
  const texto = (fin ?? '').trim()
  if (!texto) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(texto)
  if (!m) {
    const d = new Date(texto)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? '23', m[5] ?? '59', m[6] ?? '00'].map(Number)
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  const desfase = (utc: number): number | null => {
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: zona || 'America/Bogota', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utc))
      const v = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0)
      return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'), v('second')) - utc
    } catch {
      return null
    }
  }
  const d1 = desfase(comoUtc)
  if (d1 === null) return new Date(texto)
  const d2 = desfase(comoUtc - d1) ?? d1
  return new Date(comoUtc - d2)
}
