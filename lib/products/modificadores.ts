/**
 * Reglas de los grupos de modificadores (`product_modifier_groups` → `product_modifiers`), una sola
 * vez para el cobro (`precio-servidor.ts`), el selector del navegador (`ProductModifierSelector`)
 * y el aviso «Elegir» del listado. Módulo puro: sin Supabase ni React.
 *
 * Columnas verificadas por MCP el 2026-10-06: product_modifier_groups.required (bool NOT NULL),
 * min_selections (int NOT NULL), max_selections (NULL-able), selection_mode ('single' | 'multiple');
 * product_modifiers.is_active (bool NOT NULL).
 *
 * - Un grupo sin opciones activas no existe para el cliente: no se pinta ni se exige (si se
 *   exigiera, el plato no se podría pedir nunca).
 * - Mínimo exigido = max(min_selections, required ? 1 : 0), acotado por las opciones activas y,
 *   en `single`, por 1: un mínimo imposible de cumplir bloquearía la venta en vez de protegerla.
 * - Herencia: una variante sin grupos propios usa los de su padre (`parent_product_id`). Los
 *   grupos se configuran en el padre en el ERP; sin esta regla, tamaño + acompañante no se podían
 *   pedir juntos.
 */

export interface OpcionReglas {
  is_active: boolean
}

export interface GrupoReglas {
  name: string
  selection_mode: string
  required?: boolean | null
  min_selections?: number | null
  max_selections?: number | null
  product_modifiers?: OpcionReglas[] | null
}

export function opcionesActivas<O extends OpcionReglas>(grupo: { product_modifiers?: O[] | null }): O[] {
  return (grupo.product_modifiers || []).filter((m) => m.is_active === true)
}

/** Grupos que el cliente ve: con al menos una opción activa. */
export function gruposVisibles<G extends { product_modifiers?: OpcionReglas[] | null }>(grupos: G[] | null | undefined): G[] {
  return (grupos || []).filter((g) => opcionesActivas(g).length > 0)
}

/** Cuántas opciones hay que elegir como mínimo en el grupo (0 = opcional). */
export function minimoExigido(grupo: GrupoReglas): number {
  const activas = opcionesActivas(grupo).length
  if (activas === 0) return 0
  const pedido = Math.max(Number(grupo.min_selections) || 0, grupo.required === true ? 1 : 0)
  const tope = grupo.selection_mode === 'single' ? 1 : activas
  return Math.max(0, Math.min(pedido, tope))
}

export function grupoExigeEleccion(grupo: GrupoReglas): boolean {
  return minimoExigido(grupo) > 0
}

/** ¿El plato no se puede añadir sin abrir sus opciones? */
export function exigeEleccion(grupos: GrupoReglas[] | null | undefined): boolean {
  return (grupos || []).some(grupoExigeEleccion)
}

/** Texto único del error de grupo obligatorio (servidor y navegador dicen lo mismo). */
export function mensajeObligatorio(grupo: Pick<GrupoReglas, 'name'>, minimo: number): string {
  return minimo > 1
    ? `«${grupo.name}» es obligatorio: elige al menos ${minimo} opciones`
    : `«${grupo.name}» es obligatorio: elige una opción`
}

/**
 * Grupos que aplican a una línea: los propios del producto; si no tiene y es variante, los del
 * padre. Los grupos sin opciones activas no cuentan como «propios» (para el cliente no existen):
 * una variante cuyo único grupo está vacío hereda los del padre. La usan el cobro
 * (`precio-servidor.ts`), la hoja del plato, el selector de variantes, la ficha y la carta
 * clásica, para que el carrito y el servidor hablen siempre de los mismos grupos.
 */
export function gruposDeProducto<G extends { product_modifiers?: OpcionReglas[] | null }>(
  producto: { id: number; parent_product_id?: number | null },
  porProducto: Map<number, G[]>,
): G[] {
  const propios = gruposVisibles(porProducto.get(Number(producto.id)))
  if (propios.length > 0) return propios
  if (producto.parent_product_id != null) return gruposVisibles(porProducto.get(Number(producto.parent_product_id)))
  return []
}

/**
 * Respuesta de `GET /api/products/[id]/variants` → mapa para {@link gruposDeProducto}: el padre
 * con sus grupos y cada variante con grupos propios (solo las que los tienen).
 */
export function mapaGruposDeVariantes<G>(
  padreId: number,
  gruposPadre: G[] | null | undefined,
  gruposPorVariante: Record<string, G[]> | null | undefined,
): Map<number, G[]> {
  const mapa = new Map<number, G[]>()
  mapa.set(Number(padreId), Array.isArray(gruposPadre) ? gruposPadre : [])
  for (const [id, grupos] of Object.entries(gruposPorVariante || {})) {
    const n = Number(id)
    if (Number.isInteger(n) && n > 0 && Array.isArray(grupos)) mapa.set(n, grupos)
  }
  return mapa
}
