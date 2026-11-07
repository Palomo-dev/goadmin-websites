/**
 * Piezas comunes de las portadas de tienda (paquete W5). Puro: sin React.
 */
import type { CSSProperties } from 'react'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { heroSolapa, RESPALDO_HEADER_PX } from '@/lib/website/espacioHeader'

/** Prefijo de la sede servida por ruta (`data.prefijoSede`, lo pone page.tsx). `''` sin sede. */
export function prefijoDe(data: unknown): string {
  const p = data && typeof data === 'object' ? (data as { prefijoSede?: unknown }).prefijoSede : ''
  return typeof p === 'string' ? p : ''
}

/** Ruta interna con el prefijo de la sede (externas, anclas y `tel:` quedan tal cual). */
export function rutaSede(ruta: string, data: unknown): string {
  return conPrefijo(ruta, prefijoDe(data))
}

/**
 * Relleno superior cuando el encabezado transparente va encima de la portada: la misma regla de
 * HeroFullscreen (`heroSolapa`), para que el texto no quede debajo del encabezado.
 */
export function estiloSolapa(organization: unknown, content: Record<string, unknown>): CSSProperties {
  const ajustes = (organization as { website_settings?: Record<string, unknown> | null } | null)?.website_settings
  return heroSolapa(ajustes as Parameters<typeof heroSolapa>[0], content.overlap_header)
    ? { paddingTop: `var(--header-h, ${RESPALDO_HEADER_PX}px)` }
    : {}
}

/** Radio de las tarjetas grandes de la portada: el doble del radio del tema (0 si el tema es recto). */
export const RADIO_PORTADA = 'calc(var(--radio-sitio, 12px) * 2)'
