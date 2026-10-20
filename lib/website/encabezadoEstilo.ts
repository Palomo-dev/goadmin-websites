/**
 * Color del divisor y del hover de los íconos del encabezado.
 *
 * Sin un color guardado: `rgba(255,255,255,0.1)` sobre fondo oscuro y
 * `rgba(0,0,0,0.08)` sobre fondo claro. Sin fondo propio devuelve `null` y el
 * CSS (modo claro / oscuro) elige el lavado. El divisor apagado no es un color:
 * lo decide `divisorEncendido`.
 *
 * Puro: lo usan el encabezado y `scripts/verify-encabezado-pie.mjs`.
 */

export const LAVADO_OSCURO = 'rgba(255,255,255,0.1)'
export const LAVADO_CLARO = 'rgba(0,0,0,0.08)'

export function colorHexValido(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  const color = valor.trim()
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : ''
}

function canales(color: string): [number, number, number] | null {
  const hex = colorHexValido(color)
  if (!hex) return null
  const n = hex.slice(1)
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/** Luminancia relativa (WCAG). `null` si el color no es `#RGB` o `#RRGGBB`. */
export function luminanciaHex(color: string): number | null {
  const rgb = canales(color)
  if (!rgb) return null
  const lin = (c: number) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}

/**
 * Lavado según el fondo del encabezado. `null` cuando el fondo no está fijado:
 * el modo claro/oscuro del CSS pone el default.
 */
export function lavadoSegunFondo(fondo: unknown): string | null {
  const hex = colorHexValido(fondo)
  if (!hex) return null
  const lum = luminanciaHex(hex)
  if (lum === null) return null
  return lum <= 0.5 ? LAVADO_OSCURO : LAVADO_CLARO
}

/** El divisor sale encendido salvo que el editor lo apague (`false`). */
export function divisorEncendido(valor: unknown): boolean {
  return valor !== false
}

/** Hover efectivo: el color guardado, el lavado del fondo, o `null` para el CSS. */
export function colorHoverEfectivo(hover: unknown, fondo: unknown): string | null {
  return colorHexValido(hover) || lavadoSegunFondo(fondo)
}

/** Color del divisor: el guardado, el lavado del fondo, o `null` para el CSS. */
export function colorDivisorEfectivo(color: unknown, fondo: unknown): string | null {
  return colorHexValido(color) || lavadoSegunFondo(fondo)
}
