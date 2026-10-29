/**
 * Variantes de la rejilla de categorías.
 *
 * Sin `category_style`, o con `overlay`, no se usa este módulo: la tarjeta
 * superpuesta de hoy no cambia. `image_fit` vacío en estas variantes es
 * `contain`, para no recortar el producto.
 */

export type EstiloCategoria = 'circle' | 'card_bottom' | 'pill' | 'bento' | 'minimal_icon'

export function estiloCategoria(valor: unknown): EstiloCategoria | null {
  if (valor === 'circle' || valor === 'card_bottom' || valor === 'pill' || valor === 'bento' || valor === 'minimal_icon') return valor
  return null
}

export function ajusteImagenCategoria(valor: unknown): 'cover' | 'contain' | 'fill' {
  if (valor === 'cover' || valor === 'contain' || valor === 'fill') return valor
  return 'contain'
}

export function claseAjuste(valor: unknown): string {
  const ajuste = ajusteImagenCategoria(valor)
  if (ajuste === 'cover') return 'object-cover'
  if (ajuste === 'fill') return 'object-fill'
  return 'object-contain'
}

/** Grupos completos de 5 (1 grande + 4) u 8 (1 grande + 7). El resto va en un bloque final de celdas chicas (EstilosCategoria). */
export function planBento(total: number): Array<5 | 8> {
  let mejor: Array<5 | 8> = []
  let mejorSuma = 0
  const tope = Math.max(0, Math.floor(total))
  for (let ochos = 0; ochos * 8 <= tope; ochos++) {
    const cincos = Math.floor((tope - ochos * 8) / 5)
    const suma = ochos * 8 + cincos * 5
    if (suma > mejorSuma) {
      mejorSuma = suma
      mejor = [...Array(cincos).fill(5), ...Array(ochos).fill(8)]
    }
  }
  return mejor
}

export function radioTarjeta(valor: unknown, porDefecto: number): number {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : NaN
  return Number.isFinite(n) ? n : porDefecto
}

export function sombraTarjeta(valor: unknown, porDefecto: '' | 'shadow-sm' | 'shadow-md'): string {
  if (valor === 'none') return ''
  if (valor === 'sm') return 'shadow-sm'
  if (valor === 'md') return 'shadow-md'
  if (valor === 'lg') return 'shadow-lg'
  if (valor === 'xl') return 'shadow-xl'
  return porDefecto
}

/**
 * Contenedor de «Pastilla». `desktop_layout: 'carousel'` deja una sola fila con
 * desplazamiento y flechas en escritorio; cualquier otro valor (o vacío) conserva
 * las clases de siempre, que en escritorio parten en filas.
 */
export function clasesPastillas(desktopLayout: unknown): string {
  if (desktopLayout === 'carousel') return 'flex gap-3 overflow-x-auto snap-x pb-2'
  return 'flex gap-3 overflow-x-auto pb-2 md:flex-wrap'
}

/** Desplaza un carril una página (el ancho visible), como las flechas de CategoriesGrid. */
export function desplazarPagina(el: HTMLElement | null, dir: 'left' | 'right'): void {
  if (!el) return
  const amount = el.clientWidth
  el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
}
