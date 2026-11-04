/**
 * Una opción por función, para computador y celular (pedido de Juan, 27-oct).
 *
 * El editor ya no tiene un «Buscador · celular» ni una «Barra superior en el celular» aparte:
 * al cambiar la opción única guarda la clave de celular en `null`, que significa «sigue la de
 * computador». Las tiendas que nunca tocaron esa clave (ausente) o que guardaron un valor propio
 * se ven igual que antes: la clave vieja manda como respaldo.
 *
 * El buscador volvió a tener celular aparte (4-nov) sin perder el «en conjunto»: con el interruptor
 * «Buscador del celular igual al de escritorio» manda `search_style`; apagado, `mobile_search_style`
 * acepta las 7 opciones del selector y las grandes (compacta, grande, píldora) van bajo el logo.
 */

type Ajustes = Record<string, unknown> | null | undefined

/** Cómo se pinta el buscador en el celular: lupa, barra bajo el logo o nada. */
export type EstiloBuscador = 'icon' | 'bar' | 'hidden'

/** Las 7 opciones del selector «Buscador» (iguales para computador y celular). */
export const BUSCADORES_MOVIL = ['icon', 'bar', 'mini', 'icon_overlay', 'mega', 'pill_floating', 'hidden'] as const
export type BuscadorElegido = (typeof BUSCADORES_MOVIL)[number]

function buscadorValido(v: unknown): BuscadorElegido | null {
  return (BUSCADORES_MOVIL as readonly unknown[]).includes(v) ? (v as BuscadorElegido) : null
}

/** Barra visible, compacta, grande y píldora van como barra bajo el logo; ícono e ícono-encima, lupa. */
export function formaBuscadorMovil(v: BuscadorElegido): EstiloBuscador {
  if (v === 'hidden') return 'hidden'
  if (v === 'bar' || v === 'mini' || v === 'mega' || v === 'pill_floating') return 'bar'
  return 'icon'
}

/**
 * Buscador que eligió el celular sin el interruptor: valor propio guardado → ese (cualquiera de
 * las 7 opciones); `null` → el de computador; ausente → ícono (lo de siempre).
 */
function buscadorMovilPropio(ajustes: Ajustes): BuscadorElegido {
  const propio = buscadorValido(ajustes?.mobile_search_style)
  if (propio) return propio
  if (ajustes?.mobile_search_style === null) return buscadorValido(ajustes?.search_style) ?? 'icon'
  return 'icon'
}

/** Forma del buscador del celular sin el interruptor (ver `buscadorMovilPropio`). */
export function buscadorMovil(ajustes: Ajustes): EstiloBuscador {
  return formaBuscadorMovil(buscadorMovilPropio(ajustes))
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
 * Opción del celular, en conjunto o por separado: con «igual al de escritorio» es `search_style`;
 * sin él, la propia del celular (`mobile_search_style`, ver `buscadorMovilPropio`).
 */
export function buscadorMovilElegido(ajustes: Ajustes): BuscadorElegido {
  if (buscadorIgualEscritorio(ajustes)) return buscadorValido(ajustes?.search_style) ?? 'icon'
  return buscadorMovilPropio(ajustes)
}

/** Buscador del celular a pintar: lupa, barra bajo el logo (con el estilo elegido) o nada. */
export function buscadorMovilEfectivo(ajustes: Ajustes): EstiloBuscador {
  return formaBuscadorMovil(buscadorMovilElegido(ajustes))
}

/** Con estilo propio en el celular: «Barra compacta», «Buscador grande» y «Píldora flotante». */
export function buscadorMovilConEstilo(ajustes: Ajustes): boolean {
  const v = buscadorMovilElegido(ajustes)
  return v === 'mini' || v === 'mega' || v === 'pill_floating'
}

/**
 * Ajustes con que el celular arma el estilo de su barra: los mismos de computador, con el tipo
 * de buscador del celular (`search_style` y `header_builder.search.type`). Borde, forma, colores y
 * botón se comparten. En conjunto, o con la misma opción, los ajustes tal cual.
 */
export function ajustesBuscadorMovil<T extends Ajustes>(ajustes: T): T {
  if (!ajustes || buscadorIgualEscritorio(ajustes)) return ajustes
  const tipo = buscadorMovilElegido(ajustes)
  if (tipo === ajustes.search_style) return ajustes
  const hb = ajustes.header_builder
  const builder = hb && typeof hb === 'object' && !Array.isArray(hb) ? (hb as Record<string, unknown>) : null
  const busq = builder?.search && typeof builder.search === 'object' && !Array.isArray(builder.search) ? (builder.search as Record<string, unknown>) : null
  return {
    ...ajustes,
    search_style: tipo,
    ...(builder ? { header_builder: { ...builder, search: { ...(busq ?? {}), type: tipo } } } : {}),
  } as T
}
