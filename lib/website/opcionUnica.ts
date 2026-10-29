/**
 * Una opción por función, para computador y celular (pedido de Juan, 27-oct).
 *
 * El editor ya no tiene un «Buscador · celular» ni una «Barra superior en el celular» aparte:
 * al cambiar la opción única guarda la clave de celular en `null`, que significa «sigue la de
 * computador». Las tiendas que nunca tocaron esa clave (ausente) o que guardaron un valor propio
 * se ven igual que antes: la clave vieja manda como respaldo.
 */

type Ajustes = Record<string, unknown> | null | undefined

export type EstiloBuscador = 'icon' | 'bar' | 'hidden'

function estiloBuscador(v: unknown): EstiloBuscador | null {
  return v === 'icon' || v === 'bar' || v === 'hidden' ? v : null
}

/** Buscador del celular: valor propio guardado → ese; `null` → el de computador; ausente → ícono (lo de siempre). */
export function buscadorMovil(ajustes: Ajustes): EstiloBuscador {
  const propio = estiloBuscador(ajustes?.mobile_search_style)
  if (propio) return propio
  if (ajustes?.mobile_search_style === null) return estiloBuscador(ajustes?.search_style) ?? 'icon'
  return 'icon'
}

/** Barra superior en el celular: booleano guardado → ese; `null` → la de computador; ausente → oculta (lo de siempre). */
export function barraSuperiorMovil(ajustes: Ajustes): boolean {
  const v = ajustes?.mobile_show_topbar
  if (typeof v === 'boolean') return v
  if (v === null) return ajustes?.show_topbar === true
  return false
}

/**
 * «Categorías en el buscador del celular» (`mobile_search_bar_categories`). Solo `true`
 * cambia algo: con la barra del celular visible, se pinta el buscador compacto con el
 * desplegable de categorías. Ausente o `false`: la barra de siempre.
 */
export function categoriasEnBuscadorMovil(ajustes: Ajustes): boolean {
  return ajustes?.mobile_search_bar_categories === true
}
