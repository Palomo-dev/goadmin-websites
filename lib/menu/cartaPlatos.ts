/**
 * Contenido propio de la carta (`content.carta_platos` de `menu_full`) aplicado a los grupos de
 * la carta: orden de categorías y platos, ocultos, destacados y descripción / foto propias.
 *
 * ORIGEN: `leerCartaPlatos` y el orden son copia de go-admin-erp/src/lib/website/carta/contenidoCarta.ts
 * (constructor de la carta del editor). Si la regla cambia allá, se copia aquí.
 *
 * Además, solo para el lienzo del editor: los cambios por sede sin guardar (precio web, agotado,
 * oculto en la sede) que el editor envía por `goadmin:carta-sede`. En la web pública esos datos
 * salen de `website_branch_products` como siempre; aquí nunca se leen ni se escriben.
 *
 * Código puro.
 */
import type { MenuCategoryGroup, MenuItem } from './menuFull'

export interface TextoPlato {
  descripcion?: string
  foto_url?: string
}

export interface CartaPlatos {
  orden: Record<string, number[]>
  ocultos: number[]
  destacados: number[]
  textos: Record<string, TextoPlato>
}

const MAX_PLATOS = 2000

const entero = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

function ids(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  const vistos = new Set<number>()
  const out: number[] = []
  for (const x of v.slice(0, MAX_PLATOS)) {
    const n = entero(x)
    if (n !== null && !vistos.has(n)) {
      vistos.add(n)
      out.push(n)
    }
  }
  return out
}

function urlSegura(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined
  const t = v.trim().slice(0, 1000)
  // https o ruta propia; nunca `//host` (protocolo relativo = otro dominio).
  return /^(https:\/\/|\/(?!\/))/i.test(t) ? t : undefined
}

export function leerCartaPlatos(content: Record<string, unknown> | null | undefined): CartaPlatos {
  const crudo = content?.carta_platos
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return { orden: {}, ocultos: [], destacados: [], textos: {} }
  const c = crudo as Record<string, unknown>
  const orden: Record<string, number[]> = {}
  if (c.orden && typeof c.orden === 'object' && !Array.isArray(c.orden)) {
    for (const [cat, lista] of Object.entries(c.orden as Record<string, unknown>)) {
      if (/^-?\d+$/.test(cat)) {
        const l = ids(lista)
        if (l.length > 0) orden[cat] = l
      }
    }
  }
  const textos: Record<string, TextoPlato> = {}
  if (c.textos && typeof c.textos === 'object' && !Array.isArray(c.textos)) {
    for (const [id, t] of Object.entries(c.textos as Record<string, unknown>)) {
      if (!/^\d+$/.test(id) || !t || typeof t !== 'object') continue
      const tt = t as Record<string, unknown>
      const descripcion = typeof tt.descripcion === 'string' ? tt.descripcion.trim().slice(0, 500) : ''
      const foto = urlSegura(tt.foto_url)
      if (descripcion || foto) textos[id] = { ...(descripcion ? { descripcion } : {}), ...(foto ? { foto_url: foto } : {}) }
    }
  }
  return { orden, ocultos: ids(c.ocultos), destacados: ids(c.destacados), textos }
}

function ordenarPorLista<T>(items: readonly T[], idDe: (t: T) => number, orden: readonly number[] | undefined): T[] {
  if (!orden || orden.length === 0) return [...items]
  const pos = new Map(orden.map((id, i) => [id, i]))
  const con = items.filter((t) => pos.has(idDe(t))).sort((a, b) => pos.get(idDe(a))! - pos.get(idDe(b))!)
  const sin = items.filter((t) => !pos.has(idDe(t)))
  return [...con, ...sin]
}

/**
 * Aplica la carta del editor a los grupos ya armados por `buildMenuGroups`:
 * - categorías en el orden de `selected_category_ids` (si hay selección);
 * - platos en el orden guardado, destacados primero (con `featured`);
 * - sin los ocultos; con la descripción / foto propias de la carta.
 * Una carta sin contenido propio devuelve los grupos tal cual (mismo orden de siempre).
 */
export function aplicarCartaPlatos(
  grupos: MenuCategoryGroup[],
  carta: CartaPlatos,
  categoriasElegidas: number[] | null,
): MenuCategoryGroup[] {
  const ocultos = new Set(carta.ocultos)
  const destacados = new Set(carta.destacados)
  const sinCambios =
    ocultos.size === 0 && destacados.size === 0 && Object.keys(carta.orden).length === 0 &&
    Object.keys(carta.textos).length === 0 && !(categoriasElegidas && categoriasElegidas.length > 1)
  if (sinCambios) return grupos

  const ordenados = ordenarPorLista(grupos, (g) => g.id, categoriasElegidas ?? undefined)
  return ordenados
    .map((g) => {
      const visibles = g.items.filter((it) => !ocultos.has(it.id))
      const enOrden = ordenarPorLista(visibles, (it) => it.id, carta.orden[String(g.id)])
      const items: MenuItem[] = [
        ...enOrden.filter((it) => destacados.has(it.id)),
        ...enOrden.filter((it) => !destacados.has(it.id)),
      ].map((it) => {
        const texto = carta.textos[String(it.id)]
        const featured = destacados.has(it.id)
        if (!texto && !featured) return it
        return {
          ...it,
          ...(featured ? { featured: true } : {}),
          ...(texto?.descripcion ? { description: texto.descripcion } : {}),
          ...(texto?.foto_url ? { imageUrl: texto.foto_url } : {}),
        }
      })
      return { ...g, items }
    })
    .filter((g) => g.items.length > 0)
}

// ─── Solo lienzo del editor ───────────────────────────────────────────────────────────────────

/** Cambio por sede sin guardar, tal como lo manda el editor (`CambioProducto` del ERP). */
export interface CambioSedeVivo {
  product_id: number
  is_listed?: boolean
  web_price?: number | null
  is_sold_out?: boolean
  restablecer?: boolean
}

export function cambiosSedeValidos(valor: unknown): CambioSedeVivo[] {
  if (!Array.isArray(valor)) return []
  const out: CambioSedeVivo[] = []
  for (const v of valor.slice(0, MAX_PLATOS)) {
    if (!v || typeof v !== 'object') continue
    const c = v as Record<string, unknown>
    const id = entero(c.product_id)
    if (id === null) continue
    out.push({
      product_id: id,
      ...(typeof c.is_listed === 'boolean' ? { is_listed: c.is_listed } : {}),
      ...(c.web_price === null || (typeof c.web_price === 'number' && c.web_price >= 0) ? { web_price: c.web_price as number | null } : {}),
      ...(typeof c.is_sold_out === 'boolean' ? { is_sold_out: c.is_sold_out } : {}),
      ...(c.restablecer === true ? { restablecer: true } : {}),
    })
  }
  return out
}

/**
 * Pinta encima de lo guardado los cambios por sede que el editor aún no guarda. «Restablecer»
 * no se puede previsualizar sin el precio base de Inventario: se deja el plato como está.
 */
export function aplicarCambiosSedeVivos(grupos: MenuCategoryGroup[], cambios: CambioSedeVivo[]): MenuCategoryGroup[] {
  if (cambios.length === 0) return grupos
  const porId = new Map(cambios.map((c) => [c.product_id, c]))
  return grupos
    .map((g) => ({
      ...g,
      items: g.items
        .filter((it) => porId.get(it.id)?.is_listed !== false)
        .map((it) => {
          const c = porId.get(it.id)
          if (!c || c.restablecer) return it
          return {
            ...it,
            ...(typeof c.web_price === 'number' ? { price: c.web_price } : {}),
            ...(typeof c.is_sold_out === 'boolean' ? { soldOut: c.is_sold_out || it.soldOut } : {}),
          }
        }),
    }))
    .filter((g) => g.items.length > 0)
}
