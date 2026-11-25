/**
 * Datos de la cabecera: una sola fuente para todas las rutas que montan OrganizationLayout.
 *
 * El bug (2026-11-25, computador, org 338): en /consultar-pedido (y en /favoritos, /carrito,
 * /pedido/[id], /mi-cuenta…) desaparecía de la cabecera el botón «☰ Todas las categorías ▾» y el
 * menú mostraba «Categorías» como enlace suelto. La cabecera es la misma en todas las rutas, pero
 * sus datos los pasaba cada página: la comodín ([[...slug]]), categoría y búsqueda pasaban
 * `menuCategories`, `headerNavTree` y `megaMenuItems`; las demás solo `headerNav`. Sin categorías,
 * el botón (que se arma con ellas) no se pinta.
 *
 * Regla: lo que la página pase manda (la comodín ya lo calcula con su ruta); lo que no pase se toma
 * del mismo `getOrgContext()` que la página ya leyó (react.cache: ninguna consulta nueva). Así la
 * cabecera recibe lo mismo en todas las rutas. El checkout (/checkout) pinta su propia cabecera
 * (CheckoutEncabezado) y no pasa por aquí.
 *
 * Comprobación: npm run verify:datos-cabecera.
 */

/** Las cuatro piezas que la cabecera (SiteHeader) lee de OrganizationLayout. */
export const CLAVES_DATOS_CABECERA = ['headerNav', 'headerNavTree', 'menuCategories', 'megaMenuItems'] as const
export type ClaveDatosCabecera = (typeof CLAVES_DATOS_CABECERA)[number]

type Datos<H, T, C, M> = { headerNav?: H; headerNavTree?: T; menuCategories?: C; megaMenuItems?: M }

/** `true` si la página no pasó los datos de la cabecera (hay que completarlos). */
export function faltanDatosCabecera(props: { menuCategories?: unknown; headerNavTree?: unknown }): boolean {
  return props.menuCategories === undefined || props.headerNavTree === undefined
}

/**
 * Completa los datos de la cabecera: lo que trae la página manda; lo que falta sale del contexto
 * de la organización (solo si es la misma organización). `megaMenuItems` nulo en el contexto =
 * sin menú mega nombrado (la cabecera usa las categorías), igual que en la comodín.
 */
export function completarDatosCabecera<H, T, C, M>(
  props: Datos<H, T, C, M> & { organizationId: number },
  contexto: { organizationId: number; headerNav?: H; headerNavTree?: T; menuCategories?: C; megaMenuItems?: M | null } | null,
): Datos<H, T, C, M> {
  const usar = contexto && contexto.organizationId === props.organizationId ? contexto : null
  return {
    headerNav: props.headerNav ?? usar?.headerNav,
    headerNavTree: props.headerNavTree ?? usar?.headerNavTree,
    menuCategories: props.menuCategories ?? usar?.menuCategories,
    megaMenuItems: props.megaMenuItems ?? usar?.megaMenuItems ?? undefined,
  }
}
