import type { PaginacionResuelta } from './paginacionCarrusel'

/**
 * PAGINA-01: «Mostrar paginación» (content.show_pagination) es el interruptor del panel de
 * paginación. Apagado gana también cuando el panel (sección o global) está activo: se ve toda
 * la lista (con el tope de «Cantidad»/filas) y sin números. Sin el campo, nada cambia.
 */
export function conInterruptorPaginacion(mostrar: unknown, p: PaginacionResuelta): PaginacionResuelta {
  return mostrar === false && p.activo ? { ...p, activo: false } : p
}
