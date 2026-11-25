/**
 * Barra fija de compra de la ficha (Figma 2779:65038 y 2836:69391): qué pide la sección
 * `product_actions` de la plantilla. Código puro (sin React ni Supabase): lo usan la página de la
 * ficha (servidor) y la ficha en vivo del lienzo del editor (`FichaEnVivo`, cliente), así las dos
 * leen las mismas claves con la misma regla.
 *
 * - `sticky_mobile`: barra del celular (sin la clave, encendida: lo de hoy).
 * - `show_price_in_button`: «Precio dentro del botón».
 * - `sticky`: opciones de la barra al bajar (celular y computador, `leerBarraFija`).
 */
import { leerBarraFija, type BarraFijaLeida } from '@/lib/website/v2/barraFija'
import { normalizarAjustesAccionesFicha, normalizarSelectorFicha, type SelectorFicha } from '@/lib/website/v2/contrato/seccionesTienda'

interface SeccionFicha {
  section_type: string
  is_visible?: boolean | null
  content?: unknown
}

export interface BarraDeFicha {
  /** Barra del celular encendida (`sticky_mobile !== false`). */
  barraFija: boolean
  /** Barra del computador encendida (`sticky.desktop`). */
  barraEscritorio: boolean
  precioEnBarra: boolean
  opciones: BarraFijaLeida
  /** Talla al abrir y textos del selector: la barra no elige talla si el cliente debe elegirla. */
  selector: SelectorFicha
}

export function barraDeFicha(secciones: readonly SeccionFicha[]): BarraDeFicha {
  const acciones = secciones.find((s) => s.section_type === 'product_actions' && s.is_visible !== false)
  const contenido = (acciones?.content ?? {}) as Record<string, unknown>
  const opciones = leerBarraFija(contenido)
  return {
    barraFija: contenido.sticky_mobile !== false,
    barraEscritorio: opciones.escritorio.encendida,
    precioEnBarra: normalizarAjustesAccionesFicha(contenido).showPriceInButton,
    opciones,
    selector: normalizarSelectorFicha(contenido),
  }
}
