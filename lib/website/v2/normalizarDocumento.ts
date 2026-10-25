/**
 * Tolera detalles menores ANTES de validar con el contrato, para que un dato mal guardado no
 * tumbe todo el sitio a legacy (org 341, 25-oct-2026: 5 ítems del menú «Legales» con
 * `etiqueta: null`). Solo repara ítems de menú (y sus `hijos`) cuya etiqueta es null/ausente o
 * la cadena vacía real (igual que el contrato: textoCorto.min(1); solo-espacios es válida):
 * toman el título de la página a la que apuntan (`paginaId`/`pagina_id` → `paginas[].titulo`).
 * Si no resuelve, solo se usa 'Legal' dentro de un menú llamado «Legales»/«Legal»; en otro
 * caso la etiqueta queda como está. Es puro: no muta la entrada.
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
  const reparar = (lista: unknown[], esLegales: boolean): unknown[] | null => {
    let cambio = false
    const out = lista.map((item) => {
      const it = item as { etiqueta?: unknown; paginaId?: unknown; pagina_id?: unknown; hijos?: unknown } | null
      if (!it || typeof it !== 'object') return item
      let nuevo: Record<string, unknown> = it as Record<string, unknown>
      if (Array.isArray(it.hijos)) {
        const hijos = reparar(it.hijos as unknown[], esLegales)
        if (hijos) nuevo = { ...nuevo, hijos }
      }
      const vacia = it.etiqueta === null || it.etiqueta === undefined || it.etiqueta === ''
      if (vacia) {
        const pid = typeof it.paginaId === 'string' ? it.paginaId : typeof it.pagina_id === 'string' ? it.pagina_id : undefined
        const titulo = (pid ? titulos.get(pid) : undefined) ?? (esLegales ? 'Legal' : undefined)
        if (titulo !== undefined) {
          nuevo = { ...nuevo, etiqueta: titulo }
          reparados++
        }
      }
      if (nuevo !== it) cambio = true
      return nuevo
    })
    return cambio ? out : null
  }
  const menus = (doc.menus as unknown[]).map((menu) => {
    const m = menu as { items?: unknown; nombre?: unknown } | null
    if (!m || !Array.isArray(m.items)) return menu
    const esLegales = typeof m.nombre === 'string' && /^legal(es)?$/i.test(m.nombre.trim())
    const items = reparar(m.items as unknown[], esLegales)
    return items ? { ...m, items } : menu
  })
  return reparados > 0 ? { documento: { ...doc, menus }, reparados } : { documento, reparados: 0 }
}
