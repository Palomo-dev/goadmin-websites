/**
 * Opciones del carrusel por páginas de la rejilla de categorías (`categories_grid` con
 * `category_style` «circle» o «pill», `desktop_layout: 'carousel'` y filas).
 *
 * El editor guarda el panel «Carrusel» de esta sección en `content.carrusel` (con
 * `usar_global: false`) y el del sitio en `tema.carrusel` (llega por `useListaCarrusel()`);
 * los mezcla `resolverCarrusel`, como en el resto de carruseles. `categories_grid` no tiene las
 * claves sueltas de CAROUSEL_FIELDS (`autoplay`, `show_arrows`…), así que no se leen aquí.
 *
 * Sin nada guardado: flechas y puntos visibles, sin avance automático y sin bucle.
 * Sin React ni DOM: lo prueba `scripts/verify-categorias-carrusel.mjs`.
 */

import { resolverCarrusel, type ParcialCarrusel } from '@/lib/website/v2/paginacionCarrusel'

/** Lo que hace el carrusel por páginas sin ajustes guardados. */
export const BASE_CARRUSEL_CATEGORIAS: ParcialCarrusel = {
  indicador: 'puntos',
  flechasEscritorio: true,
  flechasMovil: true,
  autoplay: false,
  segundos: 5,
  loop: false,
  pausaHover: true,
  arrastre: true,
}

/** Forma de los indicadores, en los nombres de `PuntosCarrusel`. `null` = sin indicadores. */
export type PuntosCategorias = 'dots' | 'bars' | 'numbers' | null

export interface OpcionesCarruselCategorias {
  /** Algún ajuste (de la sección o del sitio) está guardado. */
  activo: boolean
  flechas: boolean
  puntos: PuntosCategorias
  autoplay: boolean
  intervaloMs: number
  loop: boolean
  pausaHover: boolean
  /** Arrastrar con el mouse (el dedo desliza siempre: es desplazamiento nativo). */
  arrastre: boolean
  /** Color del indicador activo; sin él, el primario de la tienda. */
  colorActivo?: string
}

export function opcionesCarruselCategorias(global: unknown, seccion: unknown, movil: boolean): OpcionesCarruselCategorias {
  const r = resolverCarrusel(BASE_CARRUSEL_CATEGORIAS, global, seccion, movil)
  const puntos: PuntosCategorias = r.indicador === 'ninguno'
    ? null
    : r.indicador === 'barra'
      ? 'bars'
      : r.indicador === 'numeros'
        ? 'numbers'
        : 'dots'
  return {
    activo: r.activo,
    flechas: r.flechas,
    puntos,
    autoplay: r.autoplay,
    intervaloMs: Math.min(15000, Math.max(1000, Math.round(r.segundos * 1000))),
    loop: r.loop,
    pausaHover: r.pausaHover,
    arrastre: r.arrastre,
    ...(r.activo && r.colorActivo ? { colorActivo: r.colorActivo } : {}),
  }
}
