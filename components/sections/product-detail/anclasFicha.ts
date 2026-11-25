/**
 * Reglas puras de las pestañas de la ficha (Figma «Ficha — pestañas reales» 3255-99475,
 * aprobado el 2026-11-25). Sin React ni imports: las usa PestanasFicha en el navegador y las
 * comprueba `scripts/verify-pestanas-ficha.mjs`.
 *
 * Una sola forma de hacer pestañas en la tienda: el bloque «Pestañas de la ficha»
 * (`product_anchor_nav · tabs`) y el estilo «Pestañas» / «Acordeón» de la descripción pintan la
 * misma pieza (PestanasFicha.tsx).
 *
 * - Sin JavaScript (antes de hidratar) los bloques se ven apilados, cada uno con su título: nada
 *   queda escondido si el script no carga.
 * - En el computador, pestañas de verdad: tocar una solo cambia el panel de abajo; la página no se
 *   mueve y la dirección no cambia.
 * - En el celular, acordeón con varias secciones abiertas a la vez (o las mismas pestañas, si así
 *   se eligió en el editor).
 * - Con una sola pestaña con contenido no hay barra: el bloque con su título.
 */

/** Aire entre el encabezado fijo del sitio y la barra (o el título) al que se baja. */
export const MARGEN_SALTO_ANCLA = 16

/** Ancho (px) desde el que la ficha es «computador» (el `md` de Tailwind). */
export const ANCHO_ESCRITORIO_PESTANAS = 768

export interface SaltoAncla {
  /** `getBoundingClientRect().top` del destino (la barra o el título del acordeón). */
  topDestino: number
  scrollY: number
  /** Alto del encabezado fijo del sitio (`--header-h`). */
  alturaEncabezado: number
  /** Alto de una barra fija que quedará encima del destino (0 si no la hay). */
  alturaPestanas: number
  pestanasEncima: boolean
}

/** `scrollY` al que bajar para que el destino quede justo debajo del encabezado. Nunca negativo. */
export function destinoSaltoAncla(s: SaltoAncla): number {
  const tapa = s.alturaEncabezado + (s.pestanasEncima ? s.alturaPestanas : 0) + MARGEN_SALTO_ANCLA
  const destino = Math.round(s.scrollY + s.topDestino - tapa)
  return Number.isFinite(destino) ? Math.max(0, destino) : 0
}

// ─── Cómo se pintan ─────────────────────────────────────────────────────────────────────────

export type ModoPestanas = 'apiladas' | 'pestanas' | 'acordeon'

export interface EntradaModo {
  /** ¿Ya corrió JavaScript? Sin él, apiladas. */
  hidratado: boolean
  /** Pestañas con contenido. */
  cantidad: number
  /** ¿Pantalla de computador (≥ 768 px)? */
  escritorio: boolean
  /** Qué hacer en el celular. */
  celular: 'acordeon' | 'pestanas'
  /** `acordeon` = acordeón también en el computador (estilo «Acordeón» de la descripción). */
  estilo?: 'pestanas' | 'acordeon'
}

/**
 * Apiladas sin JavaScript y con una sola pestaña (una pestaña sola no es una elección: el bloque
 * con su título). Si no, acordeón o pestañas según la pantalla y lo elegido en el editor.
 */
export function modoPestanas(e: EntradaModo): ModoPestanas {
  if (!e.hidratado || e.cantidad <= 1) return 'apiladas'
  if (e.estilo === 'acordeon') return 'acordeon'
  if (e.escritorio) return 'pestanas'
  return e.celular === 'acordeon' ? 'acordeon' : 'pestanas'
}

/**
 * Pestañas que pintan algo. `conContenido` = por id, ¿su bloque mide más de 0 px? (sin datos —p.
 * ej. características sin marca, medidas ni garantía— u oculto en este dispositivo, no). Sin medir
 * aún (servidor, primer render), todas.
 */
export function pestanasConContenido<T extends { id: string }>(
  items: readonly T[],
  conContenido: Readonly<Record<string, boolean>> | null,
): T[] {
  if (!conContenido) return [...items]
  return items.filter((i) => conContenido[i.id] === true)
}

/** Pestaña abierta: la elegida si sigue visible; si no, la preferida; si no, la primera (o `''`). */
export function pestanaActivaValida(activa: string, visibles: readonly { id: string }[], preferida?: string | null): string {
  if (visibles.some((p) => p.id === activa)) return activa
  if (preferida && visibles.some((p) => p.id === preferida)) return preferida
  return visibles[0]?.id ?? ''
}

/** Acordeón: abre o cierra `id`. Con `varias`, las demás se quedan como están. */
export function alternarAbierta(abiertas: readonly string[], id: string, varias: boolean): string[] {
  if (abiertas.includes(id)) return abiertas.filter((a) => a !== id)
  return varias ? [...abiertas, id] : [id]
}

/** Acordeón: deja `id` abierta (sin cerrar las demás si se admiten varias). */
export function abrirEnAcordeon(abiertas: readonly string[], id: string, varias: boolean): string[] {
  if (abiertas.includes(id)) return [...abiertas]
  return varias ? [...abiertas, id] : [id]
}

/** Teclado en la barra: ← → (en círculo), Inicio y Fin. Otra tecla: `null` (no se toca). */
export function siguientePorTecla(tecla: string, actual: string, ids: readonly string[]): string | null {
  if (ids.length === 0) return null
  const i = Math.max(0, ids.indexOf(actual))
  switch (tecla) {
    case 'ArrowRight': return ids[(i + 1) % ids.length]
    case 'ArrowLeft': return ids[(i - 1 + ids.length) % ids.length]
    case 'Home': return ids[0]
    case 'End': return ids[ids.length - 1]
    default: return null
  }
}

/** «Reseñas (12)»; sin reseñas, «Reseñas» a secas (nunca «(0)»). */
export function etiquetaConConteo(etiqueta: string, cantidad: number | null | undefined): string {
  return typeof cantidad === 'number' && Number.isFinite(cantidad) && cantidad > 0
    ? `${etiqueta} (${Math.round(cantidad).toLocaleString('es-CO')})`
    : etiqueta
}

// ─── Enlaces: #resenas, #envio… ─────────────────────────────────────────────────────────────

/**
 * Nombres con que se puede pedir cada pestaña en la dirección (`#resenas`) o desde otro botón
 * («Ver detalles» → envío; las estrellas → reseñas). El primero es el id del bloque en la página
 * (el destino de `#…` sin JavaScript). Valen el tipo del bloque (`#product_reviews`, los enlaces
 * de antes) y las partes de la descripción (`descripcion`, `especificaciones`, `envio`, `preguntas`).
 */
export const ALIAS_PESTANA: Readonly<Record<string, readonly string[]>> = {
  product_description: ['descripcion', 'description', 'product_description'],
  product_specs: ['caracteristicas', 'especificaciones', 'ficha-tecnica', 'specs', 'product_specs'],
  product_shipping: ['envio', 'envios', 'envio-y-devoluciones', 'devoluciones', 'shipping', 'product_shipping'],
  product_reviews: ['resenas', 'opiniones', 'reviews', 'product-reviews', 'product_reviews'],
  product_faq: ['preguntas', 'preguntas-frecuentes', 'faq', 'product_faq'],
  descripcion: ['descripcion', 'description', 'product_description'],
  especificaciones: ['especificaciones', 'caracteristicas', 'ficha-tecnica', 'specs', 'product_specs'],
  envio: ['envio', 'envios', 'envio-y-devoluciones', 'devoluciones', 'shipping', 'product_shipping'],
  preguntas: ['preguntas', 'preguntas-frecuentes', 'faq', 'product_faq'],
}

/** `#Reseñas` → `resenas`: sin `#`, sin tildes, en minúscula y con guiones. */
export function normalizarHash(hash: string | null | undefined): string {
  let t = String(hash ?? '').trim().replace(/^#/, '')
  try {
    t = decodeURIComponent(t)
  } catch {
    /* hash mal codificado: tal cual */
  }
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
}

/** Qué pestaña pide un `#…` (o un nombre de bloque). `null` si ninguna de `ids`. */
export function pestanaDeHash(hash: string | null | undefined, ids: readonly string[]): string | null {
  const h = normalizarHash(hash)
  if (!h) return null
  for (const id of ids) {
    if (normalizarHash(id) === h) return id
    if ((ALIAS_PESTANA[id] ?? []).includes(h)) return id
  }
  return null
}

/** Id del bloque en la página (destino de `#…` sin JavaScript): `resenas`, `envio`… */
export function idDomPestana(id: string): string {
  return ALIAS_PESTANA[id]?.[0] ?? normalizarHash(id)
}

// ─── Resumen de envío junto al botón ────────────────────────────────────────────────────────

/** Promesa de una zona de envío (minutos, como la guarda `shipping_zones`). */
export interface PromesaZona {
  min_minutos: number | null
  max_minutos: number | null
  envio_gratis_desde: number | null
}

export interface ResumenEnvioFicha {
  /** «Envío gratis desde $ 150.000» o `null`. */
  envioGratis: string | null
  /** «Llega en 2 a 4 días» o `null`. */
  llega: string | null
  /** Umbral en pesos (para el detalle de la pestaña), o `null`. */
  umbral: number | null
}

const MIN_POR_DIA = 1440
const MIN_POR_HORA = 60

function pesos(n: number): string {
  return `$ ${Math.round(n).toLocaleString('es-CO')}`
}

function numeroValido(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** «2 a 4 días», «45 a 60 min», «hasta 3 días». `null` sin promesa. */
export function textoPlazo(minMinutos: number | null, maxMinutos: number | null): string | null {
  const min = numeroValido(minMinutos)
  const max = numeroValido(maxMinutos)
  const ref = max ?? min
  if (ref === null || ref <= 0) return null
  const [unidad, singular, plural] = ref >= MIN_POR_DIA
    ? [MIN_POR_DIA, 'día', 'días']
    : ref >= 2 * MIN_POR_HORA ? [MIN_POR_HORA, 'hora', 'horas'] : [1, 'min', 'min']
  const hasta = Math.max(1, Math.round(ref / unidad))
  const desde = min !== null && max !== null ? Math.round(min / unidad) : null
  const nombre = hasta === 1 ? singular : plural
  if (desde !== null && desde > 0 && desde < hasta) return `${desde} a ${hasta} ${nombre}`
  return desde === hasta ? `${hasta} ${nombre}` : `hasta ${hasta} ${nombre}`
}

/**
 * Línea corta de envío junto al botón, con los datos reales de la tienda. Sin datos, nada (la
 * línea no sale).
 * - Envío gratis: sin zonas de envío activas, el `free_shipping_threshold` del sitio (si el envío
 *   está encendido). Con zonas, solo si TODAS dan envío gratis, desde la más alta (así la frase es
 *   cierta en cualquier ciudad).
 * - Plazo: de las zonas activas con promesa, del menor «desde» al mayor «hasta».
 */
export function resumenEnvioFicha(entrada: {
  envioActivo: boolean
  umbralSitio: unknown
  zonas: readonly PromesaZona[] | null | undefined
}): ResumenEnvioFicha {
  const zonas = entrada.zonas ?? []
  let umbral: number | null = null
  if (entrada.envioActivo) {
    if (zonas.length === 0) {
      const u = numeroValido(entrada.umbralSitio)
      umbral = u !== null && u > 0 ? u : null
    } else {
      const desde = zonas.map((z) => numeroValido(z.envio_gratis_desde))
      umbral = desde.every((d): d is number => d !== null && d > 0) ? Math.max(...desde) : null
    }
  }
  const mins = zonas.map((z) => numeroValido(z.min_minutos)).filter((n): n is number => n !== null && n > 0)
  const maxs = zonas.map((z) => numeroValido(z.max_minutos)).filter((n): n is number => n !== null && n > 0)
  const plazo = entrada.envioActivo && (mins.length > 0 || maxs.length > 0)
    ? textoPlazo(mins.length ? Math.min(...mins) : null, maxs.length ? Math.max(...maxs) : null)
    : null
  return {
    envioGratis: umbral !== null ? `Envío gratis desde ${pesos(umbral)}` : null,
    llega: plazo ? `Llega en ${plazo}` : null,
    umbral,
  }
}
