import type { CSSProperties } from 'react'

/**
 * MAP-08: «Estilo del mapa» (`map_style`). El mapa embebido de Google no acepta temas, así que:
 * - `satellite`: vista satélite del propio Google (`t=k`).
 * - `dark` / `light`: filtro CSS sobre el iframe (el mismo mapa, oscuro o aclarado).
 * Sin clave o `default`: el mapa de hoy, sin cambios.
 */
export function urlConEstilo(url: string, content: unknown): string {
  const estilo = (content as { map_style?: unknown } | null | undefined)?.map_style
  if (estilo !== 'satellite' || !url || !/^https:\/\/(www\.)?maps\.google\.[a-z.]+\/|^https:\/\/(www\.)?google\.[a-z.]+\/maps/.test(url)) return url
  // Enlace `maps/embed?pb=…`: el tipo de mapa va dentro de pb (`!5e0` calle, `!5e1` satélite).
  if (/\/maps\/embed\?/.test(url) && /[?&]pb=/.test(url)) {
    return /!5e\d/.test(url) ? url.replace(/!5e\d/, '!5e1') : url
  }
  return /[?&]t=/.test(url) ? url.replace(/([?&])t=[^&]*/, '$1t=k') : `${url}${url.includes('?') ? '&' : '?'}t=k`
}

export function filtroMapa(content: unknown): CSSProperties | undefined {
  const estilo = (content as { map_style?: unknown } | null | undefined)?.map_style
  if (estilo === 'dark') return { filter: 'invert(90%) hue-rotate(180deg) brightness(0.95) contrast(0.9)' }
  if (estilo === 'light') return { filter: 'grayscale(0.35) brightness(1.08) contrast(0.92)' }
  return undefined
}
