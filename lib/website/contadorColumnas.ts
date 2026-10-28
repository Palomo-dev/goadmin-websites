import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'
import { instanteFinEnZona, partesEnZona, proximoReinicioEnZona } from './relojContador'

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

export { partesEnZona }

/**
 * Fin «AAAA-MM-DDTHH:mm[:ss]» sin desfase (lo que guarda el `datetime-local` del editor) se lee en
 * `zona` (inválida → Bogotá); con Z o desfase, tal cual. `null` si no es una fecha.
 * La lógica vive en relojContador.ts, copia idéntica del ERP (vista previa del editor).
 */
export function instanteFin(fin: string, zona: string | undefined): Date | null {
  return instanteFinEnZona(fin, zonaContador(zona))
}

/** Próximo reinicio diario a `hora` (0–23) en `zona`, estrictamente después de `ahora`. */
export function proximoReinicio(ahora: Date, zona: string | undefined, hora: number | null | undefined): Date | null {
  return proximoReinicioEnZona(ahora, zonaContador(zona), hora)
}

/**
 * Objetivo vigente en cada tic: en el reinicio diario, al llegar la hora se calcula el siguiente y se
 * sigue contando sin recargar; en «hasta una fecha» se deja tal cual (al pasar, el contador se oculta).
 */
export function objetivoVigente(
  objetivo: Date | null,
  ahora: Date,
  config: { countdown_mode?: string | null; countdown_timezone?: string | null; countdown_reset_hour?: number | null },
): Date | null {
  if (config.countdown_mode !== 'daily_reset') return objetivo
  if (objetivo && objetivo.getTime() > ahora.getTime()) return objetivo
  return proximoReinicio(ahora, config.countdown_timezone ?? undefined, config.countdown_reset_hour ?? 0)
}
