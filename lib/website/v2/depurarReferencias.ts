/**
 * Quita del BORRADOR las referencias a menús o páginas que no existen en el propio documento,
 * para que la vista previa privada (y el lienzo del editor, que la usa) pinte el resto en vez de
 * responder 404.
 *
 * Por qué: el 2026-11-04 el borrador de un sitio (org 335) quedó con el pie apuntando a un menú
 * que ya no estaba y con ítems de menú hacia páginas que no estaban. Lo escribió un proceso con
 * service role directamente en `website_site_drafts`, sin pasar por el editor. El contrato
 * (`contrato/documentoSitio.ts`, copia del ERP) lo rechaza en modo estricto, la vista previa
 * devolvía `null` y el lienzo mostraba «404 This page could not be found» aunque el documento
 * tuviera todas las páginas y secciones bien.
 *
 * Alcance, a propósito estrecho:
 * - Solo trabaja sobre el JSON crudo. No valida nada; el contrato se vuelve a aplicar después.
 * - Solo toca lo que el contrato marca como `menu_inexistente` o `pagina_inexistente`:
 *   `shell.header.menuPrincipalId` / `menuMegaId` → null; `shell.footer.menuIds` sin los ids que
 *   faltan; ítems `page` (y sus hijos) cuya página no existe, fuera del menú.
 * - Nunca se usa para la web pública: la revisión publicada ya pasó el contrato al publicarse y,
 *   si no, el sitio sale por legacy como siempre.
 * - No escribe en la base: el borrador guardado queda igual y el editor sigue viendo lo suyo.
 */

export interface ResultadoDepuracion {
  documento: unknown
  /** Rutas de lo que se quitó, para el registro. Vacío = no había nada que quitar. */
  quitadas: string[]
}

type Obj = Record<string, unknown>
const esObjeto = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Códigos del contrato que esta depuración resuelve. Cualquier otro error deja la vista previa como está. */
export const CODIGOS_REFERENCIA = new Set(['menu_inexistente', 'pagina_inexistente'])

export function soloErroresDeReferencia(errores: { codigo: string }[]): boolean {
  return errores.length > 0 && errores.every((e) => CODIGOS_REFERENCIA.has(e.codigo))
}

export function depurarReferencias(entrada: unknown): ResultadoDepuracion {
  if (!esObjeto(entrada)) return { documento: entrada, quitadas: [] }
  const quitadas: string[] = []
  const doc: Obj = structuredClone(entrada)

  const menus = Array.isArray(doc.menus) ? doc.menus : []
  const paginas = Array.isArray(doc.paginas) ? doc.paginas : []
  const idsMenu = new Set(menus.filter(esObjeto).map((m) => m.id).filter((id): id is string => typeof id === 'string'))
  const idsPagina = new Set(paginas.filter(esObjeto).map((p) => p.id).filter((id): id is string => typeof id === 'string'))

  const shell = esObjeto(doc.shell) ? doc.shell : null
  const header = shell && esObjeto(shell.header) ? shell.header : null
  if (header) {
    for (const campo of ['menuPrincipalId', 'menuMegaId'] as const) {
      const id = header[campo]
      if (typeof id === 'string' && id && !idsMenu.has(id)) {
        header[campo] = null
        quitadas.push(`shell.header.${campo}`)
      }
    }
  }
  const footer = shell && esObjeto(shell.footer) ? shell.footer : null
  if (footer && Array.isArray(footer.menuIds)) {
    footer.menuIds = footer.menuIds.filter((id, i) => {
      const queda = typeof id !== 'string' || !id || idsMenu.has(id)
      if (!queda) quitadas.push(`shell.footer.menuIds.${i}`)
      return queda
    })
  }

  const depurarItems = (items: unknown[], ruta: string): unknown[] =>
    items.filter((item, i) => {
      if (!esObjeto(item)) return true
      if (item.tipo === 'page' && typeof item.paginaId === 'string' && !idsPagina.has(item.paginaId)) {
        quitadas.push(`${ruta}.${i}`)
        return false
      }
      if (Array.isArray(item.hijos)) item.hijos = depurarItems(item.hijos, `${ruta}.${i}.hijos`)
      return true
    })
  menus.forEach((menu, i) => {
    if (esObjeto(menu) && Array.isArray(menu.items)) menu.items = depurarItems(menu.items, `menus.${i}.items`)
  })

  return { documento: doc, quitadas }
}
