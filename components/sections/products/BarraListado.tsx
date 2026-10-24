'use client'

import { useState, type ReactNode } from 'react'
import type { PresentacionListado } from '@/lib/products/fuenteListado'
import type { EstadoFiltros, OrdenFiltro } from '@/lib/products/filtrosProductos'

const ORDEN: { valor: OrdenFiltro; etiqueta: string }[] = [
  { valor: 'default', etiqueta: 'Ordenar' },
  { valor: 'newest', etiqueta: 'Más nuevos' },
  { valor: 'price_asc', etiqueta: 'Precio: menor a mayor' },
  { valor: 'price_desc', etiqueta: 'Precio: mayor a menor' },
  { valor: 'sales', etiqueta: 'Más vendidos' },
  { valor: 'name', etiqueta: 'Nombre A-Z' },
]

function claseChip(estilo: PresentacionListado['chipStyle'], activo: boolean) {
  const forma = estilo === 'square' ? 'rounded-none' : estilo === 'semi' ? 'rounded-md' : estilo === 'underline' ? 'rounded-none border-x-0 border-t-0' : 'rounded-full'
  return `flex-shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium border ${forma} ${activo ? 'text-white' : 'text-gray-600 bg-white'}`
}

export function BarraListado({
  presentacion,
  categorias,
  estado,
  cambiar,
  total,
  primaryColor,
  mostrarFiltros,
  mostrarCategorias,
  marcas,
  atributos,
}: {
  presentacion: PresentacionListado
  categorias: { id: number; name: string }[]
  estado: EstadoFiltros
  cambiar: (parcial: Partial<EstadoFiltros>) => void
  total: number
  primaryColor: string
  mostrarFiltros: boolean
  mostrarCategorias: boolean
  marcas: string[]
  atributos: { id: string; etiqueta: string }[]
}) {
  const [abierto, setAbierto] = useState(false)
  const filtros = presentacion.filters
  const pedido = (nombre: string) => (filtros ? filtros.includes(nombre as never) : nombre === 'category' || nombre === 'offers')
  const opciones = presentacion.sortOptions?.length
    ? ORDEN.filter((o) => o.valor === 'default' || presentacion.sortOptions!.includes(o.valor))
    : ORDEN
  const chips = mostrarCategorias && pedido('category') && presentacion.chipMobile === 'select' ? (
    <select className="w-full rounded-lg border px-3 py-2 text-sm md:hidden" value={estado.categoria ?? ''} onChange={(e) => cambiar({ categoria: e.target.value ? Number(e.target.value) : null })}>
      {presentacion.showAllChip !== false && <option value="">Todos</option>}
      {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  ) : null
  const filaChips = mostrarCategorias && pedido('category') ? (
    <div className={`flex gap-2 pb-2 ${presentacion.chipMobile === 'select' ? 'hidden md:flex' : 'overflow-x-auto'}`}>
      {presentacion.showAllChip !== false && (
        <button type="button" onClick={() => cambiar({ categoria: null })} className={claseChip(presentacion.chipStyle, !estado.categoria)} style={!estado.categoria ? { background: primaryColor, borderColor: primaryColor } : undefined}>Todos</button>
      )}
      {categorias.map((c) => (
        <button key={c.id} type="button" onClick={() => cambiar({ categoria: estado.categoria === c.id ? null : c.id })} className={claseChip(presentacion.chipStyle, estado.categoria === c.id)} style={estado.categoria === c.id ? { background: primaryColor, borderColor: primaryColor } : undefined}>{c.name}</button>
      ))}
    </div>
  ) : null
  const pieza: Record<string, ReactNode> = {
    offers: (
      <button type="button" onClick={() => cambiar({ soloOfertas: !estado.soloOfertas })} className={claseChip(presentacion.chipStyle, estado.soloOfertas)}>Ofertas</button>
    ),
    price: (
      <>
        <input aria-label="Precio mínimo" placeholder="Mín" className="w-20 rounded-lg border px-2 py-1 text-sm" onChange={(e) => cambiar({ precioMin: e.target.value ? Number(e.target.value) : null })} />
        <input aria-label="Precio máximo" placeholder="Máx" className="w-20 rounded-lg border px-2 py-1 text-sm" onChange={(e) => cambiar({ precioMax: e.target.value ? Number(e.target.value) : null })} />
      </>
    ),
    brand: marcas.length > 0 ? (
      <select aria-label="Marca" className="rounded-lg border px-2 py-1 text-sm" value={estado.marca ?? ''} onChange={(e) => cambiar({ marca: e.target.value })}>
        <option value="">Marca</option>
        {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    ) : null,
    stock: (
      <button type="button" onClick={() => cambiar({ soloDisponibles: !estado.soloDisponibles })} className={claseChip(presentacion.chipStyle, !!estado.soloDisponibles)}>Disponibles</button>
    ),
    attributes: atributos.length > 0 ? (
      <select aria-label="Talla o color" className="rounded-lg border px-2 py-1 text-sm" value={estado.atributo ?? ''} onChange={(e) => cambiar({ atributo: e.target.value || undefined })}>
        <option value="">Talla o color</option>
        {atributos.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
      </select>
    ) : null,
    rating: (
      <select aria-label="Calificación" className="rounded-lg border px-2 py-1 text-sm" value={estado.calificacionMin ?? ''} onChange={(e) => cambiar({ calificacionMin: e.target.value ? Number(e.target.value) : null })}>
        <option value="">Calificación</option>
        <option value="4">4 o más</option>
        <option value="3">3 o más</option>
      </select>
    ),
    shipping: <span className="text-xs text-gray-500">El envío gratis se calcula en el checkout</span>,
  }
  const ordenFiltros = filtros?.length ? filtros : ['offers']
  const controles = (
    <div className="flex flex-wrap items-center gap-2">
      {ordenFiltros.map((nombre) => pedido(nombre) && nombre !== 'category' ? <span key={nombre} className="contents">{pieza[nombre]}</span> : null)}
      {presentacion.showSort !== false && (
        <select aria-label="Ordenar" value={estado.orden} onChange={(e) => cambiar({ orden: e.target.value as OrdenFiltro })} className="rounded-full border px-3 py-1.5 text-xs sm:text-sm">
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
      )}
      {presentacion.showCount !== false && <span className="ml-auto text-xs text-gray-400">{total} productos</span>}
    </div>
  )
  if (!mostrarFiltros && presentacion.showCount === false && !filaChips && !chips) return null
  const cuerpo = (
    <>
      {chips}
      {filaChips}
      {mostrarFiltros && controles}
    </>
  )
  if (presentacion.filterPosition === 'drawer') {
    return (
      <div className="mb-6 space-y-3">
        <button type="button" className="rounded-full border px-3 py-1.5 text-sm md:hidden" onClick={() => setAbierto((v) => !v)}>Filtros</button>
        <div className={abierto ? 'space-y-3' : 'hidden space-y-3 md:block'}>{cuerpo}</div>
      </div>
    )
  }
  const lateral = presentacion.filterPosition === 'side'
  return <div className={lateral ? 'mb-6 space-y-3 md:w-56 md:shrink-0' : 'mb-6 space-y-3'}>{cuerpo}</div>
}
