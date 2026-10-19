/**
 * Orden de los botones de variante en la tienda.
 *
 * El catálogo del ERP guarda el orden en `variant_values.display_order`.
 * Un `.sort()` de texto pone «L, M, S, XL, XS». Aquí manda el catálogo; si dos
 * valores empatan (o no están), las tallas de ropa van XS…XXXL y los números
 * de menor a mayor. El resto conserva el orden de texto de siempre, para no
 * mover colores que el catálogo no ordenó.
 */

/** Sin mayúsculas, tildes ni espacios sobrantes. La misma regla que el ERP. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tipo normalizado → valor normalizado → `display_order`.
 * Lo arma el servidor (`getOrdenAtributos`) y viaja al selector.
 */
export type OrdenAtributos = Record<string, Record<string, number>>

/** Rangos de ropa. «2XL» ocupa el mismo puesto que «XXL». */
const RANGO_TALLA: Record<string, number> = {
  xxxs: 0,
  '3xs': 0,
  xxs: 1,
  '2xs': 1,
  xs: 2,
  s: 3,
  m: 4,
  l: 5,
  xl: 6,
  xxl: 7,
  '2xl': 7,
  xxxl: 8,
  '3xl': 8,
  xxxxl: 9,
  '4xl': 9,
  xxxxxl: 10,
  '5xl': 10,
}

function claveTalla(valor: string): string {
  return normalizarNombre(valor).replace(/[^a-z0-9]/g, '')
}

function esNumero(valor: string): boolean {
  return /^\d/.test(valor.trim())
}

/** Empate del catálogo: talla de ropa, si no número, si no el texto de siempre. */
export function compararNaturalAtributo(a: string, b: string): number {
  const ra = RANGO_TALLA[claveTalla(a)]
  const rb = RANGO_TALLA[claveTalla(b)]
  if (ra !== undefined && rb !== undefined) return ra - rb || (a < b ? -1 : a > b ? 1 : 0)
  if (esNumero(a) && esNumero(b)) return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Ordena los valores de un atributo («Talla» → XS, S, M…).
 * `display_order` distinto gana. Empate, o valor que no está en el catálogo,
 * cae en `compararNaturalAtributo`. Un valor del catálogo va antes que uno que no.
 */
export function ordenarValoresAtributo(
  tipo: string,
  valores: readonly string[],
  orden: OrdenAtributos | null | undefined,
): string[] {
  const mapa = orden?.[normalizarNombre(tipo)]
  const puesto = (valor: string): number | undefined => {
    if (!mapa) return undefined
    return mapa[normalizarNombre(valor)]
  }
  return [...valores].sort((a, b) => {
    const oa = puesto(a)
    const ob = puesto(b)
    const aTiene = oa !== undefined
    const bTiene = ob !== undefined
    if (aTiene && bTiene && oa !== ob) return oa - ob
    if (aTiene !== bTiene) return aTiene ? -1 : 1
    return compararNaturalAtributo(a, b)
  })
}
