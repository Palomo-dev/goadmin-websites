/**
 * Claves nuevas de la tarjeta de producto (plantillas de tienda, 2026-11; PLANO §2 ítems 1-9 y 27).
 *
 * Lo que la tarjeta (`components/sections/products/ProductCard.tsx`) y la rejilla
 * (`ProductsGrid.tsx`) pintan con las claves nuevas de `product_card_style`. Cada función
 * devuelve `null`/`undefined` cuando la clave falta: la tarjeta deja entonces el marcado de hoy
 * sin tocarlo (lo comprueba `npm run verify:tarjeta-producto`, que compara el HTML con `main`).
 *
 * Código puro: sin React. Las clases de Tailwind van completas aquí (el globo `./lib/**` de
 * `tailwind.config.ts` las encuentra).
 */
import { estiloPestanas, textoDimensiones } from './v2/contrato/seccionesTienda'
import { textoPlano } from '../texto/textoPlano'
import type { EstiloTarjetaProducto } from './tarjetaProducto'

/**
 * Columnas de `products` que lee cada «línea bajo el nombre» (`card_subtitle`). Tienen que venir
 * en el select del listado (`PRODUCT_LIST_COLUMNS` de `lib/supabase/queries.ts`); lo comprueba
 * `npm run verify:select-tarjeta` contra el esquema real.
 */
export const COLUMNAS_SUBTITULO_TARJETA = {
  brand: ['brand'],
  dimensions: ['length_cm', 'width_cm', 'height_cm'],
  reference: ['reference'],
  description: ['description'],
} as const

/** Texto que antecede al precio de un producto padre con `price_prefix: 'desde'`. */
export const TEXTO_PREFIJO_DESDE = 'Desde'

/** Fondo de `button_style: 'soft'`: 8 % del color de texto del tema sobre la tarjeta. */
export const FONDO_BOTON_SUAVE = 'color-mix(in srgb, var(--text-color, #111827) 8%, transparent)'

/** Fuente de títulos del tema (misma pila que `app/globals.css` para h1-h6). */
export const FUENTE_TITULOS = 'var(--font-heading), var(--font-body), ui-sans-serif, system-ui, sans-serif'

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/** Primera línea con texto de la descripción (sin HTML). */
function primeraLinea(descripcion: unknown): string {
  if (typeof descripcion !== 'string') return ''
  for (const linea of textoPlano(descripcion).split('\n')) {
    const limpia = linea.replace(/^[\s•·\-–—*]+/, '').replace(/\s+/g, ' ').trim()
    if (limpia) return limpia
  }
  return ''
}

/**
 * Línea tenue bajo el nombre (`card_subtitle`). `null` = no se pinta: clave ausente, `none`, o el
 * producto no tiene el dato (nunca se inventa).
 */
export function subtituloTarjeta(estilo: EstiloTarjetaProducto | null | undefined, producto: unknown): string | null {
  const modo = estilo?.card_subtitle
  if (!modo || modo === 'none') return null
  const p = (producto && typeof producto === 'object' ? producto : {}) as Record<string, unknown>
  let valor = ''
  if (modo === 'brand') valor = texto(p.brand)
  else if (modo === 'reference') valor = texto(p.reference)
  else if (modo === 'dimensions') valor = textoDimensiones(p.length_cm, p.width_cm, p.height_cm) ?? ''
  else if (modo === 'description') valor = primeraLinea(p.description)
  return valor || null
}

/** «Desde» delante del precio: solo `price_prefix: 'desde'` y solo en productos padre con variantes. */
export function prefijoPrecioTarjeta(estilo: EstiloTarjetaProducto | null | undefined, padreConVariantes: boolean): string | null {
  return estilo?.price_prefix === 'desde' && padreConVariantes ? TEXTO_PREFIJO_DESDE : null
}

/** Estilo del nombre con `title_font: 'heading'`. `undefined` = el de hoy (sin atributo `style`). */
export function estiloFuenteTitulo(estilo: EstiloTarjetaProducto | null | undefined): { fontFamily: string } | undefined {
  return estilo?.title_font === 'heading' ? { fontFamily: FUENTE_TITULOS } : undefined
}

/** `hover_image_transition: 'slide'`. Ausente o `fade` = el fundido de hoy. */
export function deslizaSegundaImagen(estilo: EstiloTarjetaProducto | null | undefined): boolean {
  return estilo?.hover_image_transition === 'slide'
}

/** Clases de la segunda foto al deslizarse (la de hoy se funde: la arma la tarjeta igual que antes). */
export const CLASE_SEGUNDA_IMAGEN_DESLIZA = 'translate-x-full transition-transform duration-300 group-hover:translate-x-0'
/** La primera foto sale hacia la izquierda mientras entra la segunda. */
export const CLASE_PRIMERA_IMAGEN_DESLIZA = 'group-hover:-translate-x-full'

/** Texto del botón «Elegir» de los padres (`choose_label`). `undefined` = el de hoy. */
export function textoElegirTarjeta(estilo: EstiloTarjetaProducto | null | undefined): string | undefined {
  const t = texto(estilo?.choose_label)
  return t || undefined
}

/**
 * Rejilla con líneas (`card_grid_lines`): separación 0 y cada tarjeta corre 1 px hacia la derecha
 * y hacia abajo para que los bordes vecinos se pisen (un solo borde de 1 px entre tarjetas).
 * `null` = la rejilla de hoy.
 */
export const CLASE_REJILLA_LINEAS = 'pb-px pr-px [&>*]:-mb-px [&>*]:-mr-px'
export function rejillaConLineas(estilo: EstiloTarjetaProducto | null | undefined): { className: string; style: { gap: string } } | null {
  return estilo?.card_grid_lines === true ? { className: CLASE_REJILLA_LINEAS, style: { gap: '0px' } } : null
}

/** La tarjeta dentro de la rejilla con líneas: borde de 1 px, sin radio ni sombra. */
export function ajustesTarjetaConLineas(estilo: EstiloTarjetaProducto | null | undefined): Record<string, unknown> | null {
  if (estilo?.card_grid_lines !== true) return null
  return { card_border_width: 1, card_radius: 0, card_shadow: 'none', card_shadow_hover: 'none' }
}

/** Botón de favoritos que pinta la tarjeta con el corazón de siempre (`CardButtonRenderer`). */
export interface BotonFavoritoTarjeta {
  action: 'wishlist'
  icon_only: true
  variant: 'solid' | 'ghost'
  size: 'sm'
  bg_color?: string
  text_color: string
  radius: number
  position: 'overlay_top_right' | 'overlay_top_left'
}

/**
 * Corazón de la tarjeta (`wishlist_style` + `wishlist_position`).
 * - `undefined`: la clave falta → manda `card_buttons` de la sección (lo de hoy).
 * - `null`: `none` → la tarjeta no lleva corazón (se quita el de `card_buttons`).
 * - botón: `circle` (círculo blanco) o `ghost` (solo el ícono), en la esquina pedida de la foto.
 */
export function favoritoTarjeta(estilo: EstiloTarjetaProducto | null | undefined): BotonFavoritoTarjeta | null | undefined {
  const modo = estilo?.wishlist_style
  if (!modo) return undefined
  if (modo === 'none') return null
  const position = estilo?.wishlist_position === 'top_left' ? 'overlay_top_left' : 'overlay_top_right'
  if (modo === 'circle') {
    return { action: 'wishlist', icon_only: true, variant: 'solid', size: 'sm', bg_color: '#FFFFFF', text_color: '#111827', radius: 9999, position }
  }
  return { action: 'wishlist', icon_only: true, variant: 'ghost', size: 'sm', text_color: '#111827', radius: 9999, position }
}

/**
 * Pestañas subrayadas de `products_grid` (`tabs_style: 'underline'`) sobre la barra de filtros
 * de siempre (`BarraFiltrosProductos`): las mismas píldoras, sin caja, con una línea bajo la activa.
 * `null` = `chips` (las de hoy, sin envoltorio).
 *
 * Colores: los de la sección si los tiene; si no, la activa con el color primario y sin fondo.
 * La forma va por clases sobre la fila de categorías (`.overflow-x-auto > button`); la activa es
 * la que la barra marca con `border-transparent` (`estiloChipFiltro`).
 */
export const CLASE_PESTANAS_SUBRAYADO = [
  '[&_.overflow-x-auto]:gap-5',
  '[&_.overflow-x-auto>button]:!rounded-none',
  '[&_.overflow-x-auto>button]:!border-x-0',
  '[&_.overflow-x-auto>button]:!border-t-0',
  '[&_.overflow-x-auto>button]:!border-b-2',
  '[&_.overflow-x-auto>button]:!px-0',
  '[&_.overflow-x-auto>button]:!bg-transparent',
  '[&_.overflow-x-auto>button:not(.border-transparent)]:!border-b-transparent',
  '[&_.overflow-x-auto>button.border-transparent]:!border-b-current',
].join(' ')

export function pestanasSubrayadas<T extends Record<string, unknown>>(
  content: T | null | undefined,
  primario: string,
): { className: string; content: T & Record<string, unknown> } | null {
  if (!content || estiloPestanas(content) !== 'underline') return null
  return {
    className: CLASE_PESTANAS_SUBRAYADO,
    content: {
      ...content,
      filter_active_bg: texto(content.filter_active_bg) || 'transparent',
      filter_active_text: texto(content.filter_active_text) || primario,
    },
  }
}
