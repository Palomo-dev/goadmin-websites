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
 * «Buscador del celular igual al de escritorio» (`mobile_search_same_as_desktop`, reemplaza a la
 * clave de prueba `mobile_search_bar_categories`, que nunca salió a main). Solo `true` cambia algo.
 */
export function buscadorIgualEscritorio(ajustes: Ajustes): boolean {
  return ajustes?.mobile_search_same_as_desktop === true
}

/**
 * Buscador del celular a pintar. Con «igual al de escritorio» sigue a `search_style`:
 * barra, mini, grande y píldora → fila con barra; ícono e ícono-encima → ícono; oculto → nada.
 * Sin la opción, `buscadorMovil` (lo de siempre).
 */
export function buscadorMovilEfectivo(ajustes: Ajustes): EstiloBuscador {
  if (!buscadorIgualEscritorio(ajustes)) return buscadorMovil(ajustes)
  const v = ajustes?.search_style
  if (v === 'hidden') return 'hidden'
  if (v === 'bar' || v === 'mini' || v === 'mega' || v === 'pill_floating') return 'bar'
  return 'icon'
}
