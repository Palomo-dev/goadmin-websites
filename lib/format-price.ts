/**
 * Formatea un número como precio en formato colombiano (es-CO).
 *
 * Fuerza el mismo locale en servidor y cliente para evitar errores de hidratación.
 * Ej: 5200 -> "5.200", 60000 -> "60.000"
 */
export function formatPrice(value: number | string | null | undefined): string {
  const num = Number(value) || 0
  return num.toLocaleString('es-CO')
}
