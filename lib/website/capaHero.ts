/**
 * Capa de color y color del título de la portada (paquete 5-nov D4) para Slider y Dividido.
 *
 * Sin `overlay_color` ni `overlay_opacity` guardados, `capaPersonalizada` devuelve `null` y el
 * componente pinta lo de siempre (Slider: negro 40 %; Dividido: sin capa). Sin `title_color`,
 * el título queda con su color de hoy.
 */

const COLOR = /^(#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\)|hsla?\([^)]*\))$/i

export function colorValido(valor: unknown): string | undefined {
  return typeof valor === 'string' && COLOR.test(valor.trim()) ? valor.trim() : undefined
}

function opacidad(valor: unknown): number | undefined {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : NaN
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : undefined
}

/** Capa propia `{ backgroundColor, opacity }` o `null` si el contenido no la configuró. */
/**
 * Opacidad (%) de la capa de la portada cuando no hay `overlay_opacity` guardado, por variante
 * (QA 27-oct, D4). Es lo que la tienda pintaba antes de D4 y lo que el editor del ERP muestra
 * (DEFAULT_POR_VARIANTE.hero.overlay_opacity en go-admin-erp interruptoresSitio.ts): si cambia
 * aquí, cambiarlo allá. Dividido = 0: sin valor guardado no hay capa.
 */
export const OPACIDAD_CAPA_POR_DEFECTO = { fullscreen: 70, video: 60, slider: 40, split: 0 } as const

export function capaPersonalizada(
  content: { overlay_color?: unknown; overlay_opacity?: unknown } | null | undefined,
  opacidadPorDefecto = 40,
): { backgroundColor: string; opacity: number } | null {
  const color = colorValido(content?.overlay_color)
  const op = opacidad(content?.overlay_opacity)
  if (color === undefined && op === undefined) return null
  return { backgroundColor: color ?? '#000000', opacity: (op ?? opacidadPorDefecto) / 100 }
}

/** `style` del título: `{ color }` solo si se guardó un color propio. */
export function estiloTitulo(content: { title_color?: unknown } | null | undefined): { color: string } | undefined {
  const c = colorValido(content?.title_color)
  return c ? { color: c } : undefined
}
