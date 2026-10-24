'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu as MenuIcon, X } from 'lucide-react'
import { leerPresentacionMovil } from '@/lib/website/menuMovil'
import { MobileMenuShell } from './mobile/MobileMenuShell'
import type { MegaItem, MenuConstruido } from '@/lib/website/constructorEncabezado'
import { getLucideIcon, type HeaderVariantProps } from './HeaderShared'

type Categorias = HeaderVariantProps['menuCategories']

/**
 * Un menú del constructor (enlaces, mega o mixto) y el cajón del celular.
 * El menú de páginas de hoy sigue en `MenuZona` cuando el elemento no trae `menuId`.
 */
export function MenuBarra({
  menu,
  mega,
  categorias,
  primaryColor,
}: {
  menu: MenuConstruido
  mega: MegaItem[] | null
  categorias: Categorias
  primaryColor: string
}) {
  return (
    <nav className="flex items-center" style={{ gap: menu.gap ?? 16 }} aria-label={menu.name} data-menu-header={menu.type}>
      {menu.items.map((item) => (
        <ItemMenu key={item.href + item.label} menu={menu} item={item} mega={mega} categorias={categorias} primaryColor={primaryColor} movil={false} />
      ))}
    </nav>
  )
}

export function MenusMovil({
  menus,
  mega,
  categorias,
  primaryColor,
  settings,
}: {
  settings?: HeaderVariantProps['settings']
  menus: MenuConstruido[]
  mega: MegaItem[] | null
  categorias: Categorias
  primaryColor: string
}) {
  const lista = menus.filter((m) => m.mobile).sort((a, b) => a.mobileOrder - b.mobileOrder || a.name.localeCompare(b.name, 'es'))
  const [abierto, setAbierto] = useState(false)
  const presentacion = leerPresentacionMovil(settings)
  const contenido = lista.map((menu) => (
    <section key={menu.id} className="flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{menu.name}</p>
      {menu.items.map((item) => <ItemMenu key={item.href + item.label} menu={menu} item={item} mega={mega} categorias={categorias} primaryColor={primaryColor} movil />)}
    </section>
  ))
  if (!lista.length) return null
  return (
    <>
      <button type="button" aria-label="Abrir menú" className="inline-flex h-10 w-10 items-center justify-center" onClick={() => setAbierto(true)}>
        <MenuIcon className="h-6 w-6" />
      </button>
      {presentacion && presentacion.estilo !== 'none' && presentacion.estilo !== 'tabs' ? (
        <MobileMenuShell abierto={abierto} onCerrar={() => setAbierto(false)} estilo={presentacion.estilo} panel={presentacion.panel}>
          <div className="flex flex-col gap-4 p-4" onClick={(e) => { if ((e.target as Element).closest('a')) setAbierto(false) }}>
            <button type="button" aria-label="Cerrar menú" className="self-end p-2" onClick={() => setAbierto(false)}><X className="h-5 w-5" /></button>
            {contenido}
          </div>
        </MobileMenuShell>
      ) : abierto && (
        <div className="fixed inset-0 z-[70] md:hidden" data-menus-movil="">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} />
          <div className="absolute bottom-0 right-0 top-0 flex w-80 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-white p-4 shadow-xl">
            <button type="button" aria-label="Cerrar menú" className="self-end p-1" onClick={() => setAbierto(false)}>
              <X className="h-5 w-5" />
            </button>
            {lista.map((menu) => (
              <section key={menu.id} className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{menu.name}</p>
                {menu.items.map((item) => (
                  <ItemMenu key={item.href + item.label} menu={menu} item={item} mega={mega} categorias={categorias} primaryColor={primaryColor} movil />
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function ItemMenu({
  menu, item, mega, categorias, primaryColor, movil,
}: {
  menu: MenuConstruido
  item: MenuConstruido['items'][number]
  mega: MegaItem[] | null
  categorias: Categorias
  primaryColor: string
  movil: boolean
}) {
  const ruta = usePathname()
  const [hover, setHover] = useState(false)
  const [fijo, setFijo] = useState(false)
  const bloque = mega?.find((m) => m.href === item.href) ?? null
  const modo = menu.type === 'links' ? 'link' : menu.type === 'mega' ? 'mega' : item.kind
  const abre = modo !== 'link' && !!bloque
  const activo = ruta === item.href
  const visible = abre && (movil ? fijo : (bloque?.open === 'click' ? fijo : hover))
  const Icono = item.icon ? getLucideIcon(item.icon, null) : null
  const estilo = estiloItem(menu, primaryColor, hover || visible, activo)
  const cuerpo = (
    <>
      {Icono ? <Icono className="h-4 w-4" aria-hidden /> : null}
      <span>{item.label}</span>
      {item.badge ? (
        <span className="rounded-full px-1.5 text-[10px] font-semibold leading-4 text-white" style={{ background: primaryColor }}>{item.badge}</span>
      ) : null}
    </>
  )
  const eventos = {
    className: movil ? 'flex w-full items-center py-2 text-left' : 'inline-flex items-center',
    style: estilo,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  }
  let nodo: ReactNode
  if (!abre) {
    nodo = <Link href={item.href} {...eventos} aria-current={activo ? 'page' : undefined}>{cuerpo}</Link>
  } else if (bloque?.open === 'click' || movil) {
    nodo = <button type="button" {...eventos} aria-expanded={visible} onClick={() => setFijo((v) => !v)}>{cuerpo}</button>
  } else {
    nodo = <Link href={item.href} {...eventos} aria-expanded={visible}>{cuerpo}</Link>
  }
  return (
    <div className={movil ? 'w-full' : 'relative'} onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); if (bloque?.open !== 'click') setFijo(false) }}>
      {nodo}
      {visible && bloque && (
        modo === 'dropdown'
          ? <ListaSimple bloque={bloque} categorias={categorias} movil={movil} />
          : <PanelMega bloque={bloque} categorias={categorias} primaryColor={primaryColor} movil={movil} />
      )}
    </div>
  )
}

function estiloItem(menu: MenuConstruido, primary: string, marcado: boolean, activo: boolean): CSSProperties {
  const color = activo && menu.active ? menu.active : marcado && menu.hover ? menu.hover : menu.color
  const indicador = menu.indicator ?? 'none'
  const tinte = marcado || activo
  return {
    fontFamily: menu.font === 'serif' ? 'Georgia, "Times New Roman", serif' : menu.font === 'mono' ? 'ui-monospace, monospace' : undefined,
    fontSize: menu.size ?? 14,
    fontWeight: menu.weight === 'bold' ? 700 : menu.weight === 'semibold' ? 600 : menu.weight === 'medium' ? 500 : 400,
    color,
    textTransform: menu.uppercase ? 'uppercase' : undefined,
    letterSpacing: menu.uppercase ? '0.04em' : undefined,
    gap: 6,
    padding: indicador === 'pill' || indicador === 'background' ? '4px 10px' : '4px 0',
    borderRadius: indicador === 'pill' ? 999 : indicador === 'background' ? 6 : undefined,
    background: tinte && indicador === 'pill'
      ? `color-mix(in srgb, ${menu.hover || primary} 16%, transparent)`
      : tinte && indicador === 'background' ? `color-mix(in srgb, ${menu.hover || primary} 10%, transparent)` : undefined,
    boxShadow: indicador === 'underline' && tinte ? `inset 0 -2px 0 ${menu.active || menu.hover || primary}` : undefined,
  }
}

function enlacesDe(col: MegaItem['columnas'][number], categorias: Categorias) {
  if (col.links.length) return col.links
  const padre = categorias?.find((c) => c.id === col.categoryId)
  return (padre?.children ?? []).slice(0, 12).map((h) => ({ label: h.name, href: `/categorias/${h.slug}` }))
}

function ListaSimple({ bloque, categorias, movil }: { bloque: MegaItem; categorias: Categorias; movil: boolean }) {
  const links = bloque.columnas.flatMap((col) => enlacesDe(col, categorias)).slice(0, 12)
  return (
    <div className={movil ? 'mb-2 pl-3' : 'absolute left-0 top-full z-50 mt-2 w-56 rounded-lg bg-white p-2 shadow-lg'} data-menu-desplegable="">
      {links.map((l) => <Link key={l.href} href={l.href} className="block px-2 py-1.5 text-sm">{l.label}</Link>)}
    </div>
  )
}

function PanelMega({
  bloque, categorias, primaryColor, movil,
}: {
  bloque: MegaItem
  categorias: Categorias
  primaryColor: string
  movil: boolean
}) {
  const columnas = bloque.columnas.slice(0, bloque.columns)
  if (movil) {
    return (
      <div className="mb-2 pl-3">
        {columnas.map((col) => (
          <div key={col.title || col.links[0]?.href} className="mb-2">
            {col.title && <p className="text-xs font-semibold">{col.title}</p>}
            {col.image && <img src={col.image} alt="" className="my-1 h-16 w-full rounded object-cover" />}
            {enlacesDe(col, categorias).map((l) => <Link key={l.href} href={l.href} className="block py-1 text-sm">{l.label}</Link>)}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div
      className={`absolute left-0 top-full z-50 mt-2 grid gap-4 p-4 ${bloque.animation === 'slide' ? 'animate-in slide-in-from-top-2' : ''}`}
      style={{
        width: bloque.width === 'full' ? '70vw' : Math.max(240, 220 * bloque.columns),
        gridTemplateColumns: `repeat(${Math.max(1, columnas.length || bloque.columns)}, minmax(0,1fr))`,
        background: bloque.background || '#fff',
        borderRadius: bloque.radius,
        boxShadow: bloque.shadow ? '0 16px 40px rgba(0,0,0,.12)' : undefined,
      }}
      data-mega=""
    >
      {columnas.map((col) => (
        <div key={col.title || col.image || 'col'} className={bloque.dividers ? 'border-r pr-3 last:border-0' : ''}>
          {col.title && <p className="mb-2 text-sm font-semibold" style={{ color: primaryColor }}>{col.title}</p>}
          {col.image && <a href={col.imageHref || '#'}><img src={col.image} alt="" className="mb-2 h-24 w-full rounded object-cover" /></a>}
          {col.text && <p className="mb-2 text-sm">{col.text}</p>}
          {enlacesDe(col, categorias).map((l) => <Link key={l.href} href={l.href} className="block py-1 text-sm">{l.label}</Link>)}
          {col.products && <p className="text-xs text-gray-500">Productos de la categoría</p>}
        </div>
      ))}
    </div>
  )
}
