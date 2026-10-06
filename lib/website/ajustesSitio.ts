/**
 * Ajustes del sitio que el ERP guarda en `website_settings` desde Sitio web › Configuración y
 * › Ventas en línea, leídos de forma defensiva y tipada.
 *
 * Contrato del ERP (go-admin-erp):
 * - `src/lib/website/configuracionSitio.ts` (esquema `esquemaCambiosConfiguracion`, `IDIOMAS_SITIO`)
 *   y la RPC `update_website_settings` (migración 20261006122511).
 * - `src/components/sitio-web/ventas/estadoVentas.ts` y la migración 20261006122435
 *   (`checkout_guest_enabled`, `checkout_min_order_amount`, `multi_outlet_mode`).
 *
 * Columnas verificadas por MCP el 2026-10-06 (93 filas, todas con branch_id NULL y todas en su
 * default: ninguna organización usa estos ajustes todavía):
 *   maintenance_mode boolean NOT NULL DEFAULT false · maintenance_message text NULL (≤ 300)
 *   site_locale text NOT NULL DEFAULT 'es-CO' (CHECK es-CO|en|fr|pt)
 *   custom_code jsonb NOT NULL DEFAULT '[]' (≤ 20 bloques)
 *   whatsapp_number text NULL (≤ 40) · whatsapp_greeting text NULL (≤ 200)
 *   checkout_guest_enabled boolean NOT NULL DEFAULT true
 *   checkout_min_order_amount numeric(14,2) NULL (≥ 0)
 *   multi_outlet_mode text NOT NULL DEFAULT 'selector' (CHECK selector|per_branch)
 *
 * Regla de esta lectura: cualquier valor ausente, nulo o fuera del contrato vale lo mismo que el
 * DEFAULT de la columna, que es exactamente el comportamiento que el sitio tenía antes de que
 * existieran. Así un caché viejo, una fila sin migrar o un valor raro nunca cambian un sitio.
 *
 * Puro (sin React ni Supabase, solo `import type`): lo usan el servidor, el navegador y
 * `scripts/verify-ajustes-sitio.mjs`. La lectura cacheada está en `./ajustesSitio.server.ts`.
 */

/** Idiomas que el ERP deja elegir (`IDIOMAS_SITIO` y el CHECK `website_settings_site_locale_valido`). */
export const IDIOMAS_SITIO = ['es-CO', 'en', 'fr', 'pt'] as const
export type IdiomaSitio = (typeof IDIOMAS_SITIO)[number]
export const IDIOMA_POR_DEFECTO: IdiomaSitio = 'es-CO'

export type ModoSedes = 'selector' | 'per_branch'
export type PosicionCodigo = 'head' | 'body'

/** Un bloque de código a medida ya validado con las reglas del ERP. */
export interface BloqueCodigo {
  id: string
  nombre: string
  /** `todas` o una ruta («/gracias»), sin el prefijo de la sede. */
  alcance: string
  posicion: PosicionCodigo
  codigo: string
}

export interface AjustesSitio {
  mantenimiento: { activo: boolean; mensaje: string | null }
  idioma: IdiomaSitio
  /** Bloques ACTIVOS y válidos, en el orden del ERP. */
  codigoPropio: BloqueCodigo[]
  /** `null` = sin número: no hay botón flotante (lo de hoy). */
  whatsapp: { numero: string; saludo: string | null } | null
  checkout: {
    /** `true` = el cliente compra sin cuenta (lo de hoy). */
    invitado: boolean
    /** `null` = sin mínimo (lo de hoy). */
    pedidoMinimo: number | null
  }
  modoSedes: ModoSedes
}

/** Lo que valía el sitio antes de estos ajustes (los DEFAULT de las columnas). */
export const AJUSTES_POR_DEFECTO: AjustesSitio = Object.freeze({
  mantenimiento: { activo: false, mensaje: null },
  idioma: IDIOMA_POR_DEFECTO,
  codigoPropio: [],
  whatsapp: null,
  checkout: { invitado: true, pedidoMinimo: null },
  modoSedes: 'selector',
}) as AjustesSitio

// Límites del ERP (esquemaCambiosConfiguracion y los CHECK de la migración).
export const MAX_BLOQUES_CODIGO = 20
export const MAX_CARACTERES_CODIGO = 20000
const MAX_NOMBRE_CODIGO = 80
const MAX_ALCANCE_CODIGO = 200
const ALCANCE_VALIDO = /^(todas|\/[\w\-/]*)$/
const WHATSAPP_VALIDO = /^[+\d\s()-]+$/
const MAX_WHATSAPP = 40
const MAX_SALUDO = 200
const MAX_MENSAJE_MANTENIMIENTO = 300

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t && t.length <= max ? t : null
}

function idiomaDe(v: unknown): IdiomaSitio {
  return typeof v === 'string' && (IDIOMAS_SITIO as readonly string[]).includes(v) ? (v as IdiomaSitio) : IDIOMA_POR_DEFECTO
}

/**
 * `custom_code` → bloques que se pueden inyectar. Mismas reglas que valida el ERP al guardar:
 * nombre 1–80, alcance `todas` o `/ruta`, posición head|body, código 1–20 000 caracteres, como
 * mucho 20 bloques. `activo` ausente cuenta como activo (igual que `codigoDeFila` del ERP). Un
 * bloque que no cumple se descarta entero: nunca se inyecta código a medias.
 */
export function bloquesCodigo(v: unknown): BloqueCodigo[] {
  if (!Array.isArray(v)) return []
  const salida: BloqueCodigo[] = []
  for (const item of v.slice(0, MAX_BLOQUES_CODIGO)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const c = item as Record<string, unknown>
    if (c.activo === false) continue
    const id = texto(c.id, 64)
    const nombre = texto(c.nombre, MAX_NOMBRE_CODIGO)
    const alcance = typeof c.alcance === 'string' ? c.alcance.trim() : 'todas'
    // Igual que `codigoDeFila` del ERP y la RPC: lo que no es `head` va antes de </body>.
    const posicion: PosicionCodigo = c.posicion === 'head' ? 'head' : 'body'
    const codigo = typeof c.codigo === 'string' ? c.codigo : ''
    if (!id || !nombre) continue
    if (alcance.length > MAX_ALCANCE_CODIGO || !ALCANCE_VALIDO.test(alcance)) continue
    if (!codigo.trim() || codigo.length > MAX_CARACTERES_CODIGO) continue
    salida.push({ id, nombre, alcance, posicion, codigo })
  }
  return salida
}

/** ¿El bloque se carga en esta ruta? `ruta` sin el prefijo de la sede y sin query. */
export function bloqueAplicaEnRuta(bloque: Pick<BloqueCodigo, 'alcance'>, ruta: string): boolean {
  if (bloque.alcance === 'todas') return true
  const limpia = (ruta.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/'
  const alcance = bloque.alcance.replace(/\/+$/, '') || '/'
  if (alcance === '/') return limpia === '/'
  return limpia === alcance || limpia.startsWith(`${alcance}/`)
}

export function bloquesParaRuta(bloques: readonly BloqueCodigo[], ruta: string): BloqueCodigo[] {
  return bloques.filter((b) => bloqueAplicaEnRuta(b, ruta))
}

function importeMinimo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  // 0 o negativo = sin mínimo (el CHECK impide negativos; 0 no restringe nada).
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Fila de `website_settings` (o `null`) → ajustes tipados. Nunca lanza. */
export function ajustesSitioDesdeFila(fila: Record<string, unknown> | null | undefined): AjustesSitio {
  if (!fila || typeof fila !== 'object') return AJUSTES_POR_DEFECTO
  const numero = texto(fila.whatsapp_number, MAX_WHATSAPP)
  return {
    mantenimiento: {
      activo: fila.maintenance_mode === true,
      mensaje: texto(fila.maintenance_message, MAX_MENSAJE_MANTENIMIENTO),
    },
    idioma: idiomaDe(fila.site_locale),
    codigoPropio: bloquesCodigo(fila.custom_code),
    whatsapp: numero && WHATSAPP_VALIDO.test(numero) && /\d/.test(numero)
      ? { numero, saludo: texto(fila.whatsapp_greeting, MAX_SALUDO) }
      : null,
    checkout: {
      invitado: fila.checkout_guest_enabled !== false,
      pedidoMinimo: importeMinimo(fila.checkout_min_order_amount),
    },
    modoSedes: fila.multi_outlet_mode === 'per_branch' ? 'per_branch' : 'selector',
  }
}

/** Enlace `wa.me` del botón flotante: solo dígitos; 10 dígitos colombianos llevan el 57. */
export function enlaceWhatsapp(w: { numero: string; saludo: string | null }): string {
  const digitos = w.numero.replace(/\D/g, '')
  const numero = digitos.length === 10 ? `57${digitos}` : digitos
  return `https://wa.me/${numero}${w.saludo ? `?text=${encodeURIComponent(w.saludo)}` : ''}`
}
