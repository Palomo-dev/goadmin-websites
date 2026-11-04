/**
 * Ícono y color del ícono de las categorías (4-nov).
 *
 * 1. Íconos automáticos: sin `categories.icon`, el nombre de la categoría elige un ícono de
 *    lucide por palabra clave (sin tildes, en minúsculas, palabra completa, admite plural).
 *    Sin coincidencia: `null` (quien pinta usa «Tag» o su respaldo de siempre).
 * 2. `contenido.icon_color` y `contenido.icon_bg_mode` de `categories_grid` (contrato:
 *    `esquemaColorIconoCategoria`, `esquemaFondoIconoCategoria`). Ausentes = lo de hoy.
 *
 * Los nombres se validan contra lucide-react 0.454.0 al pintar (`IconoCategoria`): un nombre
 * inexistente pasa al siguiente candidato y al final a «Tag», nunca rompe la página.
 * `npm run verify:iconos-categoria` comprueba que cada ícono del mapa existe en esa versión.
 */
import { esquemaColorIconoCategoria, esquemaFondoIconoCategoria, type FondoIconoCategoria } from './v2/contrato/documentoSitio'

/**
 * Palabras clave → ícono. Gana la primera regla que coincide, por eso las frases y las más
 * específicas van antes («cámara ip» antes que «cámara»). Las palabras van ya normalizadas.
 */
export const ICONOS_POR_PALABRA: ReadonlyArray<readonly [readonly string[], string]> = [
  [['camara ip', 'seguridad'], 'Cctv'],
  [['cuidado personal'], 'Sparkles'],
  [['celular', 'smartphone'], 'Smartphone'],
  [['portatil', 'laptop'], 'Laptop'],
  [['tablet'], 'Tablet'],
  [['audifono'], 'Headphones'],
  [['parlante'], 'Speaker'],
  [['reloj', 'smartwatch'], 'Watch'],
  [['monitor'], 'Monitor'],
  [['tv', 'televisor'], 'Tv'],
  [['consola', 'gamer'], 'Gamepad2'],
  [['camara'], 'Camera'],
  [['impresora'], 'Printer'],
  [['cable', 'cargador'], 'Cable'],
  [['mouse', 'teclado'], 'Mouse'],
  [['olla', 'sarten'], 'CookingPot'],
  [['cuchillo', 'cubierto'], 'UtensilsCrossed'],
  [['licuadora'], 'Blend'],
  [['nevera'], 'Refrigerator'],
  [['lavadora'], 'WashingMachine'],
  [['ventilador', 'clima'], 'Fan'],
  [['colchon', 'almohada'], 'BedDouble'],
  [['mueble'], 'Sofa'],
  [['zapatilla', 'tenis'], 'Footprints'],
  [['camiseta', 'ropa'], 'Shirt'],
  [['gorra'], 'Crown'],
  [['gato'], 'Cat'],
  [['mascota', 'perro'], 'PawPrint'],
  [['gym', 'pesa'], 'Dumbbell'],
  [['oficina', 'silla'], 'Armchair'],
  [['papeleria'], 'PenLine'],
  [['agricultura', 'semilla'], 'Sprout'],
  [['hogar', 'casa'], 'House'],
]

/** Sin tildes ni diéresis y en minúsculas («Cámaras» → «camaras»). */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function palabras(texto: string): string[] {
  return normalizarTexto(texto).split(/[^a-z0-9]+/).filter(Boolean)
}

/** La palabra o su plural («celular», «celulares»; «tablet», «tablets»). */
function esLaPalabra(palabra: string, clave: string): boolean {
  return palabra === clave || palabra === `${clave}s` || palabra === `${clave}es`
}

function contieneClave(lista: string[], clave: string): boolean {
  const partes = clave.split(' ')
  for (let i = 0; i + partes.length <= lista.length; i++) {
    if (partes.every((p, j) => esLaPalabra(lista[i + j], p))) return true
  }
  return false
}

/** Ícono por el nombre de la categoría, o `null` si ninguna palabra clave coincide. */
export function iconoPorNombre(nombre: unknown): string | null {
  if (typeof nombre !== 'string' || !nombre.trim()) return null
  const lista = palabras(nombre)
  for (const [claves, icono] of ICONOS_POR_PALABRA) {
    if (claves.some((c) => contieneClave(lista, c))) return icono
  }
  return null
}

type CategoriaConIcono = { icon?: unknown; name?: unknown }

/**
 * Candidatos en orden: el ícono guardado (`categories.icon`) y el automático por el nombre.
 * `IconoCategoria` pinta el primero que exista en lucide y, si ninguno, «Tag».
 */
export function candidatosIconoCategoria(cat: CategoriaConIcono): string[] {
  const propio = typeof cat.icon === 'string' ? cat.icon.trim() : ''
  const auto = iconoPorNombre(cat.name)
  return [propio, auto].filter((v, i, a): v is string => !!v && a.indexOf(v) === i)
}

/** ¿La categoría tiene ícono (propio o automático)? Sin ninguno, cada estilo usa su respaldo de siempre. */
export function tieneIconoCategoria(cat: CategoriaConIcono): boolean {
  return candidatosIconoCategoria(cat).length > 0
}

/** Color secundario del sitio (lo define OrganizationLayoutCliente). */
export const COLOR_SECUNDARIO = 'var(--secondary-color, #1E40AF)'

/**
 * Color del ícono según `icon_color`, o `null` si la sección no lo eligió (o el valor no es
 * válido): quien pinta sigue con su color de hoy.
 */
export function colorIconoCategoria(
  contenido: { icon_color?: unknown } | null | undefined,
  colores: { categoria?: string | null; primario: string },
): string | null {
  const r = esquemaColorIconoCategoria.safeParse(contenido?.icon_color)
  if (!r.success) return null
  if (r.data === 'category') return colores.categoria || colores.primario
  if (r.data === 'primary') return colores.primario
  if (r.data === 'secondary') return COLOR_SECUNDARIO
  return r.data
}

/** `icon_bg_mode` válido, o `null` (el fondo de hoy). */
export function fondoIconoCategoria(contenido: { icon_bg_mode?: unknown } | null | undefined): FondoIconoCategoria | null {
  const r = esquemaFondoIconoCategoria.safeParse(contenido?.icon_bg_mode)
  return r.success ? r.data : null
}

/**
 * Fondo y color del ícono con `icon_bg_mode`:
 * - `soft`: `image_bg` o un tinte suave del color del ícono.
 * - `solid`: `image_bg` o el color del ícono lleno, y el ícono en blanco.
 * - `none`: sin fondo.
 */
export function estiloFondoIcono(
  modo: FondoIconoCategoria,
  color: string,
  imageBg?: unknown,
): { fondo: string; colorIcono: string } {
  const explicito = typeof imageBg === 'string' && imageBg.trim() ? imageBg.trim() : null
  if (modo === 'none') return { fondo: 'transparent', colorIcono: color }
  if (modo === 'solid') return { fondo: explicito ?? color, colorIcono: '#FFFFFF' }
  return { fondo: explicito ?? `color-mix(in srgb, ${color} 14%, white)`, colorIcono: color }
}
