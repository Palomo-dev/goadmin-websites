/**
 * Variantes de la rejilla de categorías.
 *
 * Sin `category_style`, o con `overlay`, no se usa este módulo: la tarjeta
 * superpuesta de hoy no cambia. `image_fit` vacío en estas variantes es
 * `contain`, para no recortar el producto.
 */

export type EstiloCategoria = 'circle' | 'card_bottom' | 'pill' | 'bento' | 'minimal_icon' | 'title_top' | 'text_list'

export function estiloCategoria(valor: unknown): EstiloCategoria | null {
  if (valor === 'circle' || valor === 'card_bottom' || valor === 'pill' || valor === 'bento' || valor === 'minimal_icon') return valor
  // Plantillas de tienda (PLANO §2 ítem 15): título y conteo encima de la foto. 0 secciones lo
  // usan en producción (SQL 2026-11-07); antes caía en la tarjeta superpuesta de siempre.
  if (valor === 'title_top') return valor
  // «Lista de texto» (decisión del dueño 2026-11-10): una fila de nombres enlazados. Antes caía en
  // la tarjeta superpuesta de siempre; sin la clave nada cambia.
  if (valor === 'text_list') return valor
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

/** `mobile_layout` de la rejilla: `list` y `grid` cambian el celular; el resto (vacío, `inherit`, `carousel`) es el carril de siempre. */
export function layoutMovilCategorias(valor: unknown): 'list' | 'grid' | 'carousel' {
  return valor === 'list' || valor === 'grid' ? valor : 'carousel'
}

/** Degradado a la derecha del carril del celular: deja claro que se desliza. En escritorio no hay máscara. */
export const MASCARA_CARRIL = '[mask-image:linear-gradient(to_right,#000_85%,transparent)] md:[mask-image:none]'

/** Alineación de las pastillas en escritorio (`align`): por defecto centradas bajo el título. */
export function alineacionPastillas(valor: unknown): 'left' | 'center' {
  return valor === 'left' ? 'left' : 'center'
}

/**
 * Centrado de las pastillas en escritorio. En filas que se parten, `md:justify-center`. En
 * carrusel, `safe center`: centradas cuando caben; si desbordan, empiezan a la izquierda y se
 * desplazan (un centrado simple escondería las primeras). Navegador sin `safe`: a la izquierda,
 * como antes.
 */
const CENTRO_FILA = ' md:justify-center'
const CENTRO_CARRUSEL = ' md:[justify-content:safe_center]'

/**
 * Contenedor de «Pastilla».
 * - Celular: `list` = columna; `grid` = 2 columnas; vacío/`carousel` = carril con degradado.
 * - Escritorio: `desktop_layout: 'carousel'` = una fila con desplazamiento (y flechas en
 *   CarruselPastillas solo si desborda); cualquier otro valor = filas que se parten.
 * - `align` (4-nov): 'center' (por defecto) centra en escritorio; 'left', a la izquierda (antes).
 */
export function clasesPastillas(desktopLayout: unknown, mobileLayout?: unknown, align?: unknown): string {
  const movil = layoutMovilCategorias(mobileLayout)
  const carrusel = desktopLayout === 'carousel'
  const centro = alineacionPastillas(align) === 'center' ? (carrusel ? CENTRO_CARRUSEL : CENTRO_FILA) : ''
  if (movil === 'list') return (carrusel ? 'flex flex-col gap-2 md:flex-row md:gap-3 md:overflow-x-auto md:snap-x md:pb-2' : 'flex flex-col gap-2 md:flex-row md:flex-wrap') + centro
  if (movil === 'grid') return (carrusel ? 'grid grid-cols-2 gap-2 md:flex md:gap-3 md:overflow-x-auto md:snap-x md:pb-2' : 'grid grid-cols-2 gap-2 md:flex md:flex-wrap') + centro
  return (carrusel ? `flex gap-3 overflow-x-auto snap-x pb-2 ${MASCARA_CARRIL}` : `flex gap-3 overflow-x-auto pb-2 md:flex-wrap ${MASCARA_CARRIL}`) + centro
}

/** Contenedor de «Círculo» en el celular (en escritorio va aparte). */
export function clasesCirculosMovil(mobileLayout: unknown): string {
  const movil = layoutMovilCategorias(mobileLayout)
  if (movil === 'list') return 'flex flex-col gap-3 md:hidden'
  if (movil === 'grid') return 'grid grid-cols-2 gap-4 md:hidden'
  return `flex gap-4 overflow-x-auto pb-2 md:hidden ${MASCARA_CARRIL}`
}

/** Desplaza un carril una página (el ancho visible), como las flechas de CategoriesGrid. */
export function desplazarPagina(el: HTMLElement | null, dir: 'left' | 'right'): void {
  if (!el) return
  const amount = el.clientWidth
  el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
}

// ─── Opciones de tarjeta de las plantillas de tienda (PLANO §2 ítems 16-18) ─────────────────
// Se leen con `normalizarAjustesCategorias` (contrato seccionesTienda). Con los defaults
// (`bottom` / `none` / `none`) ninguna de estas ayudas cambia nada: es la tarjeta de hoy.

/** `categories.color` si es un hex válido (#rgb o #rrggbb); si no, `null` (no se pinta color). */
export function colorDeCategoria(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const v = valor.trim()
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null
}

/** Texto legible sobre un fondo hex: oscuro sobre claro, blanco sobre oscuro (luminancia WCAG). */
export function textoSobreColor(hex: string): '#111827' | '#FFFFFF' {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const canal = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminancia = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
  // Contraste contra negro (#111827 ≈ 0,0116) frente a blanco: gana el mayor.
  return (luminancia + 0.05) / (0.0116 + 0.05) >= 1.05 / (luminancia + 0.05) ? '#111827' : '#FFFFFF'
}

/** Proporción de la foto en «Título arriba»: `image_ratio` si es uno conocido; si no, 4:5. */
export function proporcionTituloArriba(valor: unknown): string {
  if (valor === '1:1') return 'aspect-square'
  if (valor === '4:3') return 'aspect-[4/3]'
  if (valor === '3:4') return 'aspect-[3/4]'
  if (valor === '16:9') return 'aspect-video'
  return 'aspect-[4/5]'
}
