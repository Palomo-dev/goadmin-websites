/**
 * Interruptores de carrusel del inspector (CAROUSEL_FIELDS del ERP) → opciones efectivas.
 *
 * Cada componente pasa en `hoy` lo que hacía ANTES de leer las claves: con la clave ausente el
 * sitio se ve y se comporta exactamente igual. El editor guarda las claves con estos nombres
 * (`autoplay`, `interval_ms`, `loop`, `pause_on_hover`, `show_arrows`, `show_dots`,
 * `enable_swipe`); el JSON de Supabase a veces las trae como texto ("true"/"false").
 *
 * Sin React ni DOM: lo prueba `scripts/verify-interruptores.mjs`.
 */

export interface OpcionesCarrusel {
  autoplay: boolean
  intervaloMs: number
  bucle: boolean
  pausarAlPasar: boolean
  flechas: boolean
  puntos: boolean
  deslizar: boolean
}

export function booleano(valor: unknown, porDefecto: boolean): boolean {
  if (valor === undefined || valor === null || valor === '') return porDefecto
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'string') return valor !== 'false' && valor !== '0'
  return Boolean(valor)
}

const INTERVALO_MIN = 1000
const INTERVALO_MAX = 15000

export function leerOpcionesCarrusel(content: Record<string, unknown> | null | undefined, hoy: OpcionesCarrusel): OpcionesCarrusel {
  const c = content ?? {}
  const ms = Number(c.interval_ms)
  return {
    autoplay: booleano(c.autoplay, hoy.autoplay),
    // Mismo rango que el control del editor (1000–15000 ms).
    intervaloMs: Number.isFinite(ms) && ms > 0 ? Math.min(INTERVALO_MAX, Math.max(INTERVALO_MIN, ms)) : hoy.intervaloMs,
    bucle: booleano(c.loop, hoy.bucle),
    pausarAlPasar: booleano(c.pause_on_hover, hoy.pausarAlPasar),
    flechas: booleano(c.show_arrows, hoy.flechas),
    puntos: booleano(c.show_dots, hoy.puntos),
    deslizar: booleano(c.enable_swipe, hoy.deslizar),
  }
}

/** Índice siguiente; `null` si no hay a dónde ir (sin bucle y en el último). */
export function indiceSiguiente(actual: number, total: number, bucle: boolean): number | null {
  if (total <= 1) return null
  if (actual + 1 < total) return actual + 1
  return bucle ? 0 : null
}

/** Índice anterior; `null` si no hay a dónde ir (sin bucle y en el primero). */
export function indiceAnterior(actual: number, total: number, bucle: boolean): number | null {
  if (total <= 1) return null
  if (actual > 0) return actual - 1
  return bucle ? total - 1 : null
}

/** Atributos `data-*` con las opciones efectivas: dejan ver en el HTML qué leyó el componente. */
export function atributosCarrusel(o: OpcionesCarrusel): Record<string, string> {
  return {
    'data-carrusel-autoplay': String(o.autoplay),
    'data-carrusel-bucle': String(o.bucle),
    'data-carrusel-pausa': String(o.pausarAlPasar),
    'data-carrusel-deslizar': String(o.deslizar),
    'data-carrusel-flechas': String(o.flechas),
    'data-carrusel-paginacion': String(o.puntos),
  }
}
