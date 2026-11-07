/**
 * Portada de las plantillas de tienda (paquete W5): qué datos pide cada pieza nueva y cómo se
 * leen de `data` (lo que precarga `app/[[...slug]]/page.tsx`).
 *
 * Reglas:
 * - Una pieza sin su opción en el documento no pide nada (`necesidadesPortadaTienda` devuelve
 *   vacío para cualquier página de hoy): ninguna consulta nueva en las 83 tiendas.
 * - Nada inventado: sin reseñas reales no hay resumen, sin productos no hay mini tarjetas, sin
 *   usuario de Instagram no se escribe ninguno.
 *
 * Código puro: sin React, Next ni Supabase (lo leen el servidor, los componentes y
 * `scripts/verify-portada-tienda.mjs`).
 */
import {
  normalizarAjustesTestimonios,
  normalizarPortadaBuscador,
  normalizarPortadaFlotante,
  normalizarPortadaMarca,
  normalizarProductosPortada,
  textoResumenResenas,
  type FUENTES_RESUMEN,
} from './v2/contrato/seccionesTienda'

export type FuenteResumen = (typeof FUENTES_RESUMEN)[number]

/** Promedio y conteo reales (lo que devuelve `getResumenResenas`). */
export interface ResumenResenas {
  promedio: number
  cantidad: number
}

/** `data.resumenResenas`: una entrada por fuente pedida; `null` si la lectura falló. */
export type ResumenesPorFuente = Partial<Record<FuenteResumen, ResumenResenas | null>>

/** Lo mínimo de una sección que hace falta para decidir (fila de `website_page_sections`). */
export interface SeccionParaPortada {
  section_type: string
  section_variant: string
  content?: unknown
  is_visible?: boolean | null
}

export interface NecesidadesPortada {
  /** Fuentes de resumen de reseñas que alguna sección muestra. */
  resumenes: FuenteResumen[]
  /** La portada pinta categorías reales (selector del buscador o chips de la portada flotante). */
  categorias: boolean
  /** Ids de productos que la portada nombra (productos de la portada y puntos de la marca). */
  idsProductos: number[]
  /** `split_products` sin ids: pinta los primeros productos con foto del listado general. */
  primerosProductos: boolean
}

function contenido(s: SeccionParaPortada): Record<string, unknown> {
  return s.content && typeof s.content === 'object' && !Array.isArray(s.content) ? (s.content as Record<string, unknown>) : {}
}

/**
 * Qué datos piden las secciones de la página. Con secciones de hoy (sin variantes nuevas ni
 * `show_summary`), todo vacío: el llamador no consulta nada.
 */
export function necesidadesPortadaTienda(secciones: readonly SeccionParaPortada[] | null | undefined): NecesidadesPortada {
  const resumenes = new Set<FuenteResumen>()
  const ids: number[] = []
  let categorias = false
  let primerosProductos = false
  const sumarIds = (lista: number[]) => {
    for (const id of lista) if (!ids.includes(id)) ids.push(id)
  }
  for (const s of secciones ?? []) {
    if (s.is_visible === false) continue
    const c = contenido(s)
    if (s.section_type === 'testimonials') {
      const a = normalizarAjustesTestimonios(c)
      if (a.showSummary) resumenes.add(a.summarySource)
      continue
    }
    if (s.section_type !== 'hero') continue
    if (s.section_variant === 'search') {
      const p = normalizarPortadaBuscador(c)
      if (p.ratingChip === 'auto') resumenes.add('product_reviews')
      if (p.showCategorySelect) categorias = true
    } else if (s.section_variant === 'floating') {
      const p = normalizarPortadaFlotante(c)
      if (p.floatingCards.some((t) => t.kind === 'rating')) resumenes.add('product_reviews')
      if (p.floatingCards.some((t) => t.kind === 'categories')) categorias = true
    } else if (s.section_variant === 'split_products') {
      const { productIds } = normalizarProductosPortada(c)
      if (productIds.length > 0) sumarIds(productIds)
      else primerosProductos = true
    } else if (s.section_variant === 'brand_giant') {
      sumarIds(normalizarPortadaMarca(c).hotspots.map((h) => h.productId))
    } else {
      // Variantes de hoy: no piden nada nuevo.
    }
  }
  return { resumenes: [...resumenes].sort(), categorias, idsProductos: ids.slice(0, 24), primerosProductos }
}

/** ¿Hay que consultar algo? `false` en toda página de hoy. */
export function pidePortadaTienda(n: NecesidadesPortada): boolean {
  return n.resumenes.length > 0 || n.categorias || n.idsProductos.length > 0 || n.primerosProductos
}

// ─── Lectura de `data` en los componentes ───────────────────────────────────────────────────

function esResumen(v: unknown): v is ResumenResenas {
  return !!v && typeof v === 'object' && typeof (v as ResumenResenas).promedio === 'number' && typeof (v as ResumenResenas).cantidad === 'number'
}

/**
 * «4,9 de 1.280 reseñas» con el agregado real de `data.resumenResenas[fuente]`, o `null` (sin
 * datos, sin reseñas o la lectura falló): la pieza no se pinta.
 */
export function textoResumenDe(data: unknown, fuente: FuenteResumen): string | null {
  const mapa = data && typeof data === 'object' ? (data as { resumenResenas?: unknown }).resumenResenas : null
  const r = mapa && typeof mapa === 'object' ? (mapa as Record<string, unknown>)[fuente] : null
  return esResumen(r) ? textoResumenResenas(r.promedio, r.cantidad) : null
}

/** Parte «4,9 de 1.280 reseñas» en la cifra («4,9») y el resto («de 1.280 reseñas»). */
export function partirResumen(texto: string): { cifra: string; resto: string } {
  const i = texto.indexOf(' de ')
  return i < 0 ? { cifra: texto, resto: '' } : { cifra: texto.slice(0, i), resto: texto.slice(i + 1) }
}

/** Producto tal como llega de los listados del sitio (solo lo que se lee aquí). */
export interface ProductoListado {
  id: number
  uuid?: string | null
  name?: string | null
  product_images?: unknown[] | null
  [clave: string]: unknown
}

function productos(v: unknown): ProductoListado[] {
  return Array.isArray(v) ? v.filter((p): p is ProductoListado => !!p && typeof p === 'object' && Number.isInteger((p as ProductoListado).id)) : []
}

function tieneFoto(p: ProductoListado): boolean {
  return Array.isArray(p.product_images) && p.product_images.length > 0
}

/**
 * Productos de la portada: con ids, esos en ese orden (los que existan); sin ids, los primeros
 * `max` con foto. Busca en `data.productosPortada` (precarga de la portada) y en `data.products`
 * (listado general, si la página ya lo cargó).
 */
export function productosDePortada(data: unknown, ids: readonly number[], max: number): ProductoListado[] {
  const d = (data && typeof data === 'object' ? data : {}) as { productosPortada?: unknown; products?: unknown }
  const todos = [...productos(d.productosPortada), ...productos(d.products)]
  if (ids.length > 0) {
    const salida: ProductoListado[] = []
    for (const id of ids) {
      const p = todos.find((x) => x.id === id)
      if (p && !salida.includes(p)) salida.push(p)
      if (salida.length >= max) break
    }
    return salida
  }
  const vistos = new Set<number>()
  const salida: ProductoListado[] = []
  for (const p of todos) {
    if (vistos.has(p.id) || !tieneFoto(p)) continue
    vistos.add(p.id)
    salida.push(p)
    if (salida.length >= max) break
  }
  return salida
}

/** Enlace a la ficha: por uuid si el listado lo trae; si no, por id (la ficha redirige al uuid). */
export function rutaProducto(id: number, producto?: ProductoListado | null): string {
  const uuid = typeof producto?.uuid === 'string' && producto.uuid ? producto.uuid : null
  return `/productos/${uuid ?? id}`
}

/** Categoría tal como llega de `getOrganizationCategories`. */
export interface CategoriaPortada {
  id: number
  name: string
  slug: string
}

/** Categorías principales (sin padre) con nombre y slug, en el orden del listado, hasta `max`. */
export function categoriasDePortada(data: unknown, max = 30): CategoriaPortada[] {
  const lista = data && typeof data === 'object' ? (data as { categories?: unknown }).categories : null
  if (!Array.isArray(lista)) return []
  const salida: CategoriaPortada[] = []
  for (const c of lista) {
    if (!c || typeof c !== 'object') continue
    const o = c as Record<string, unknown>
    if (o.parent_id != null) continue
    if (!Number.isInteger(o.id) || typeof o.name !== 'string' || !o.name.trim() || typeof o.slug !== 'string' || !o.slug.trim()) continue
    salida.push({ id: o.id as number, name: o.name.trim(), slug: o.slug.trim() })
    if (salida.length >= max) break
  }
  return salida
}

// ─── Instagram (gallery · instagram_cta) ────────────────────────────────────────────────────

const USUARIO_IG = /^[A-Za-z0-9._]{1,30}$/

/**
 * Usuario de Instagram de `website_settings.social_links.instagram` (en producción se guarda como
 * URL, `https://instagram.com/<usuario>`; también se acepta `@usuario`). `''` si no hay o no es
 * de Instagram: no se escribe ningún usuario.
 */
export function usuarioInstagram(socialLinks: unknown): string {
  const crudo = socialLinks && typeof socialLinks === 'object' ? (socialLinks as Record<string, unknown>).instagram : null
  if (typeof crudo !== 'string') return ''
  const t = crudo.trim()
  const m = /^https?:\/\/(?:www\.)?instagram\.com\/([^/?#\s]+)/i.exec(t)
  const usuario = m ? m[1] : t.replace(/^@/, '')
  return USUARIO_IG.test(usuario) && !/^(p|reel|reels|explore|stories)$/i.test(usuario) ? usuario : ''
}

/** Perfil público de un usuario ya validado. */
export function urlPerfilInstagram(usuario: string): string | null {
  return USUARIO_IG.test(usuario) ? `https://www.instagram.com/${usuario}/` : null
}

/** Dónde va la tarjeta del llamado en la fila de fotos: tras la mitad (redondeando abajo). */
export function posicionLlamadoInstagram(fotos: number): number {
  return Math.max(0, Math.floor(fotos / 2))
}

// ─── Cupón del banner ───────────────────────────────────────────────────────────────────────

const MESES_CORTOS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.']

/**
 * «Válido hasta el 31 dic. 2026» de una fecha plana `YYYY-MM-DD` (día calendario: no se convierte
 * de zona). `null` sin fecha válida.
 */
export function textoVigencia(fechaPlana: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaPlana)
  if (!m) return null
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return `Válido hasta el ${dia} ${MESES_CORTOS[mes - 1]} ${m[1]}`
}
