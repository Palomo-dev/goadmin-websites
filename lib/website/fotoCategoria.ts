/**
 * Foto de respaldo de una categoría (cuadrícula de categorías, detalle, subcategorías).
 *
 * Orden de preferencia:
 *   1. La image_url propia de la categoría (nunca se toca).
 *   2. La foto de un producto directo de la categoría (como siempre).
 *   3. La foto de un producto de sus descendientes, a cualquier profundidad: primero las hijas,
 *      luego las nietas, etc. (búsqueda por niveles), en el orden en que llega el árbol.
 *
 * Funciones puras, sin imports: las prueba scripts/verify-foto-categoria.mjs.
 */

export interface NodoCategoria {
  id: number
  parent_id: number | null | undefined
}

/** Mapa padre → hijas, en el orden en que llega el árbol. */
export function hijasPorPadre(arbol: readonly NodoCategoria[]): Map<number, number[]> {
  const mapa = new Map<number, number[]>()
  for (const nodo of arbol) {
    if (nodo.parent_id == null || nodo.parent_id === nodo.id) continue
    const lista = mapa.get(nodo.parent_id)
    if (lista) lista.push(nodo.id)
    else mapa.set(nodo.parent_id, [nodo.id])
  }
  return mapa
}

/**
 * Descendientes de `raiz` por niveles (hijas, nietas…), sin la raíz y sin repetir.
 * Protegido contra ciclos (A → B → A) y contra datos corruptos.
 */
export function descendientesPorNivel(hijas: Map<number, number[]>, raiz: number): number[] {
  const vistos = new Set<number>([raiz])
  const salida: number[] = []
  let nivel = [raiz]
  while (nivel.length > 0) {
    const siguiente: number[] = []
    for (const id of nivel) {
      for (const hija of hijas.get(id) || []) {
        if (vistos.has(hija)) continue
        vistos.add(hija)
        salida.push(hija)
        siguiente.push(hija)
      }
    }
    nivel = siguiente
  }
  return salida
}

/**
 * Elige la foto de cada categoría sin image_url.
 * `fotoDirecta[id]` = foto de un producto directo (activo y visible) de la categoría `id`.
 * Devuelve solo las categorías a las que se les encontró foto de respaldo.
 */
export function fotosDeRespaldo(
  categorias: readonly { id: number; image_url?: string | null }[],
  fotoDirecta: Readonly<Record<number, string>>,
  hijas: Map<number, number[]>
): Record<number, string> {
  const salida: Record<number, string> = {}
  for (const cat of categorias) {
    if (cat.image_url) continue
    if (fotoDirecta[cat.id]) {
      salida[cat.id] = fotoDirecta[cat.id]
      continue
    }
    for (const d of descendientesPorNivel(hijas, cat.id)) {
      if (fotoDirecta[d]) {
        salida[cat.id] = fotoDirecta[d]
        break
      }
    }
  }
  return salida
}
