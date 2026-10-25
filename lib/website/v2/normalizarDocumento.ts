/**
 * Tolera detalles menores ANTES de validar con el contrato, para que un dato mal guardado no
 * tumbe todo el sitio a legacy (org 341, 25-oct-2026: 5 ítems del menú «Legales» con
 * `etiqueta: null`). Hoy solo repara eso: ítems de menú con etiqueta nula o vacía toman el
 * título de la página a la que apuntan (`paginaId` → `paginas[].titulo`) o, si no, 'Legal'.
 * Es puro: no muta la entrada. Cualquier otro error sigue llegando al contrato.
 */
export function normalizarDocumentoPublico(documento: unknown): { documento: unknown; reparados: number } {
  if (!documento || typeof documento !== 'object') return { documento, reparados: 0 }
  const doc = documento as { paginas?: unknown; menus?: unknown }
  if (!Array.isArray(doc.menus)) return { documento, reparados: 0 }
  const titulos = new Map<string, string>()
  if (Array.isArray(doc.paginas)) {
    for (const p of doc.paginas as { id?: unknown; titulo?: unknown }[]) {
      if (p && typeof p.id === 'string' && typeof p.titulo === 'string' && p.titulo.trim()) titulos.set(p.id, p.titulo)
    }
  }
  let reparados = 0
  const menus = (doc.menus as unknown[]).map((menu) => {
    const m = menu as { items?: unknown } | null
    if (!m || !Array.isArray(m.items)) return menu
    let cambio = false
    const items = (m.items as unknown[]).map((item) => {
      const it = item as { etiqueta?: unknown; paginaId?: unknown } | null
      if (!it || typeof it !== 'object') return item
      if (typeof it.etiqueta === 'string' && it.etiqueta.trim()) return item
      if (it.etiqueta !== null && it.etiqueta !== undefined && typeof it.etiqueta !== 'string') return item
      const titulo = typeof it.paginaId === 'string' ? titulos.get(it.paginaId) : undefined
      cambio = true
      reparados++
      return { ...it, etiqueta: titulo ?? 'Legal' }
    })
    return cambio ? { ...m, items } : menu
  })
  return reparados > 0 ? { documento: { ...doc, menus }, reparados } : { documento, reparados: 0 }
}
