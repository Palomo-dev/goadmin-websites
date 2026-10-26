/**
 * Términos «Populares» del buscador.
 *
 * Salen de las ventas de la organización, o de sus categorías si aún no hay
 * ventas. Nunca una lista fija de otra tienda.
 */

const ESTADOS_FUERA = new Set(['cancelled', 'canceled', 'anulado', 'void', 'refunded', 'failed'])

export interface FilaPopular {
  product_name?: string | null
  quantity?: number | string | null
  status?: string | null
  order_status?: string | null
}

function fuera(estado: string | null | undefined): boolean {
  return !!estado && ESTADOS_FUERA.has(estado.toLowerCase())
}

function nombreLimpio(valor: string | null | undefined): string | null {
  const nombre = (valor ?? '').trim().replace(/\s+/g, ' ')
  if (nombre.length < 2 || nombre.length > 80) return null
  return nombre
}

/** Nombres ordenados por unidades vendidas. Vacío si no hay filas útiles. */
export function terminosPopulares(filas: readonly FilaPopular[], limite = 6): string[] {
  const tope = limite >= 1 && limite <= 12 ? limite : 6
  const cuenta = new Map<string, { nombre: string; unidades: number }>()
  for (const fila of filas) {
    if (fuera(fila.status) || fuera(fila.order_status)) continue
    const nombre = nombreLimpio(fila.product_name)
    if (!nombre) continue
    const clave = nombre.toLocaleLowerCase('es')
    const qty = Number(fila.quantity)
    const suma = Number.isFinite(qty) && qty > 0 ? qty : 1
    const previo = cuenta.get(clave)
    if (previo) previo.unidades += suma
    else cuenta.set(clave, { nombre, unidades: suma })
  }
  return [...cuenta.values()]
    .sort((a, b) => b.unidades - a.unidades || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, tope)
    .map((fila) => fila.nombre)
}

/** Ventas si hay; si no, nombres de categoría de la misma organización. */
export function terminosOCategorias(
  ventas: readonly FilaPopular[],
  categorias: readonly (string | null | undefined)[],
  limite = 6,
): string[] {
  const deVentas = terminosPopulares(ventas, limite)
  if (deVentas.length > 0) return deVentas
  const tope = limite >= 1 && limite <= 12 ? limite : 6
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const crudo of categorias) {
    const nombre = nombreLimpio(crudo)
    if (!nombre) continue
    const clave = nombre.toLocaleLowerCase('es')
    if (vistos.has(clave)) continue
    vistos.add(clave)
    salida.push(nombre)
    if (salida.length >= tope) break
  }
  return salida
}
