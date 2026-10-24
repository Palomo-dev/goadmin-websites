'use client'

import Link from 'next/link'

interface ItemMenu {
  custom_label?: string | null
  custom_url?: string | null
  page?: { slug?: string | null; title?: string | null } | null
  children?: ItemMenu[]
}

interface MenuCatalogo {
  id: string
  name?: string | null
  items?: ItemMenu[]
}

interface PedidoMenu {
  menuId?: string
  zone?: string
}

function hrefDe(item: ItemMenu): string {
  if (item.custom_url) return item.custom_url
  if (item.page?.slug) return item.page.slug === 'home' ? '/' : `/${item.page.slug}`
  return '/'
}

function etiquetaDe(item: ItemMenu): string {
  return item.custom_label || item.page?.title || ''
}

/**
 * Menús adicionales del encabezado. Sin `header_menus` no pinta nada:
 * el menú principal sigue donde está.
 */
export function MenusExtra({ settings, zone }: { settings?: Record<string, unknown> | null; zone: 'header' | 'topbar' | 'menu' }) {
  const pedidos = Array.isArray(settings?.header_menus) ? (settings.header_menus as PedidoMenu[]) : []
  const catalogo = Array.isArray(settings?.menus_catalogo) ? (settings.menus_catalogo as MenuCatalogo[]) : []
  const elegidos = pedidos.filter((p) => p && p.zone === zone && typeof p.menuId === 'string')
  if (!elegidos.length || !catalogo.length) return null
  const porId = new Map(catalogo.map((m) => [m.id, m]))
  return (
    <div className={zone === 'topbar' ? 'bg-gray-900 text-white' : 'border-b border-black/10 bg-white'} data-menus-extra={zone}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2">
        {elegidos.map((pedido) => {
          const menu = porId.get(pedido.menuId!)
          if (!menu) return null
          return (
            <nav key={`${zone}-${menu.id}`} aria-label={menu.name || 'Menú'} className="flex flex-wrap items-center gap-4">
              {(menu.items || []).map((item, i) => {
                const texto = etiquetaDe(item)
                if (!texto) return null
                return (
                  <Link key={item.custom_label || i} href={hrefDe(item)} className={`text-sm font-medium ${zone === 'topbar' ? 'text-white/90 hover:text-white' : 'text-gray-800 hover:text-gray-950'}`}>
                    {texto}
                  </Link>
                )
              })}
            </nav>
          )
        })}
      </div>
    </div>
  )
}
