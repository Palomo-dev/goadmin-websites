/**
 * Enlaces a /membresias cuando la tienda NO tiene membresías (0 planes activos).
 *
 * Decisión del dueño (2026-11-25, Figma «16 Sitio web» D): sin planes activos /membresias responde
 * 404 con la marca de la tienda y, además, se quita sola del menú, del pie, del menú inferior y
 * del sitemap. Si mañana crean un plan, todo vuelve a aparecer sin tocar nada.
 *
 * Aquí solo se FILTRA lo que ya se cargó (árboles de páginas, menús nombrados, mega menú, botones
 * del menú inferior): ninguna consulta. Puro, sin React ni Supabase.
 */

import { SLUG_PAGINA_MEMBRESIAS } from '@/lib/website/v2/contrato/paginaMembresias'

/**
 * ¿El destino es la página de membresías de este sitio? `/membresias`, `membresias`,
 * `/sede-norte/membresias`, con `?…` o `#…`. Una URL absoluta (`https://…`) es de otro sitio:
 * no se toca.
 */
export function apuntaAMembresias(destino: unknown): boolean {
  if (typeof destino !== 'string') return false
  const limpio = destino.trim()
  if (!limpio || /^[a-z][a-z0-9+.-]*:/i.test(limpio) || limpio.startsWith('//')) return false
  const partes = limpio.split(/[?#]/)[0].split('/').filter(Boolean)
  if (partes.length === 0 || partes.length > 2) return false
  return partes[partes.length - 1].toLowerCase() === SLUG_PAGINA_MEMBRESIAS
}

/** Quita de un árbol los nodos que llevan a /membresias (y sus hijos). */
export function sinNodosMembresias<T>(lista: readonly T[] | null | undefined, destino: (n: T) => unknown): T[] {
  if (!Array.isArray(lista)) return []
  return lista
    .filter((n) => !apuntaAMembresias(destino(n)))
    .map((n) => {
      const hijos = (n as { children?: unknown }).children
      return Array.isArray(hijos) ? ({ ...n, children: sinNodosMembresias(hijos as T[], destino) } as T) : n
    })
}

/** Lo que se lee de un ítem de menú nombrado. */
export interface ItemMenuEnlace {
  item_type?: string | null
  page?: { slug?: string | null } | null
  custom_url?: string | null
}

/** Destino de un ítem de menú nombrado (página por su slug o enlace propio). */
export function destinoItemMenu(item: ItemMenuEnlace): unknown {
  if (item.item_type === 'page' || item.item_type === 'policy') return item.page?.slug ?? null
  if (item.item_type === 'custom_link') return item.custom_url ?? null
  return null
}

/** Menús nombrados (pie y demás) sin los ítems que llevan a /membresias. */
export function menusSinMembresias<M extends { items?: readonly ItemMenuEnlace[] | null }>(menus: readonly M[] | null | undefined): M[] {
  if (!Array.isArray(menus)) return []
  return menus.map((m) => (Array.isArray(m.items) ? { ...m, items: sinNodosMembresias(m.items as readonly ItemMenuEnlace[], destinoItemMenu) } : m))
}

/**
 * Ajustes del sitio sin los botones del menú inferior que llevan a /membresias («Prueba gratis»
 * = acción `trial`, o una página/enlace a /membresias). Devuelve el MISMO objeto si no hay nada
 * que quitar: los sitios sin esos botones no cambian.
 */
export function ajustesSinMembresias<T>(ajustes: T): T {
  const s = ajustes as unknown as Record<string, unknown> | null
  const cabecera = s && typeof s.mobile_header === 'object' && s.mobile_header ? (s.mobile_header as Record<string, unknown>) : null
  const menu = cabecera && typeof cabecera.bottom_nav === 'object' && cabecera.bottom_nav ? (cabecera.bottom_nav as Record<string, unknown>) : null
  if (!menu || !Array.isArray(menu.items)) return ajustes
  const items = menu.items as unknown[]
  const quedan = items.filter((x) => {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null
    if (!o) return true
    return !(o.action === 'trial' || apuntaAMembresias(o.target) || apuntaAMembresias(o.href))
  })
  if (quedan.length === items.length) return ajustes
  return { ...s, mobile_header: { ...cabecera, bottom_nav: { ...menu, items: quedan } } } as unknown as T
}

/** ¿Algo de lo cargado apunta a /membresias? Si no, no hace falta mirar los planes. */
export function mencionaMembresias(...cargado: unknown[]): boolean {
  for (const c of cargado) {
    if (c == null) continue
    let t: string
    try {
      t = JSON.stringify(c)
    } catch {
      continue
    }
    if (t.includes(SLUG_PAGINA_MEMBRESIAS) || t.includes('"trial"')) return true
  }
  return false
}
