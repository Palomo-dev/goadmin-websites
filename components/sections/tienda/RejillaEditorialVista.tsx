'use client'

/**
 * Rejilla de `products_grid · editorial` (ver `RejillaEditorial.tsx`).
 *
 * Reusa lo de `ProductsGrid` en vez de copiarlo: `useCatalogoCompleto` (listado general por
 * partes), `filtrarProductosPorCategorias` / `ordenarListado` / `topeProductos` (lo que eligió el
 * editor), `useFiltrosProductos` (categoría y orden del visitante, en memoria) y `ProductCard`
 * sin `onAddToCart` (su carrito interno de lib/cart). Ningún cambio en el carrito ni en precios.
 */

import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ProductCard } from '../products/ProductCard'
import { useFiltrosProductos } from '../products/BarraFiltrosProductos'
import { useEstiloTarjeta } from '@/components/site/TarjetaProductoContext'
import { useCatalogoCompleto } from '@/lib/products/useCatalogoCompleto'
import { categoriasDisponibles, filtrarProductosPorCategorias, incluirSubcategorias, unirProductosDeCategoria, type OrdenFiltro } from '@/lib/products/filtrosProductos'
import { ordenarListado, topeProductos } from '@/lib/products/limiteListado'
import { isOutOfStock } from '@/lib/stock'
import { clasesColumnasProductos } from '@/lib/website/presentacionTienda'
import { separacionTarjetas } from '@/lib/website/tarjetaProducto'
import type { RejillaEditorial, TarjetaEditorial } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'

/** De a cuántos crece «Ver más» sin tope del editor (la página de `ProductsGrid`). */
const POR_TANDA = 12

const ORDENES: ReadonlyArray<{ valor: OrdenFiltro; texto: string }> = [
  { valor: 'default', texto: 'Destacados' },
  { valor: 'newest', texto: 'Novedades' },
  { valor: 'price_asc', texto: 'Precio: menor a mayor' },
  { valor: 'price_desc', texto: 'Precio: mayor a menor' },
  { valor: 'name', texto: 'Nombre' },
]

/** Clases del ancho de una tarjeta editorial (estáticas para Tailwind). */
const ANCHO_EDITORIAL: Record<TarjetaEditorial['span'], string> = {
  2: 'col-span-full lg:col-span-2',
  3: 'col-span-full lg:col-span-2 xl:col-span-3',
}

interface RejillaEditorialVistaProps {
  content: Record<string, any>
  ajustes: RejillaEditorial
  primaryColor: string
  productos: any[]
  desdeServidor: boolean
  totalServidor: number | null
  productosCategoria?: any[]
  categorias: any[]
  error: boolean
  subdominio: string
  branchId: number | null
  mostrarComprarYa: boolean
}

export function RejillaEditorialVista({
  content,
  ajustes,
  primaryColor,
  productos,
  desdeServidor,
  totalServidor,
  productosCategoria,
  categorias,
  error,
  subdominio,
  branchId,
  mostrarComprarYa,
}: RejillaEditorialVistaProps) {
  const estiloSeccion = useEstiloTarjeta(content.product_card_style)
  const separacion = separacionTarjetas(estiloSeccion)
  const general = useCatalogoCompleto(productos, totalServidor, !desdeServidor)
  const todos = desdeServidor ? productos : general.productos
  const [visibles, setVisibles] = useState(POR_TANDA)

  // Lo que eligió el editor: categorías, orden y agotados (como ProductsGrid sin listado).
  const base = useMemo(() => {
    if (desdeServidor) return todos
    const fuente = unirProductosDeCategoria(todos, productosCategoria, content.selected_category_ids)
    const filtrados = filtrarProductosPorCategorias(fuente, content.selected_category_ids, categorias, incluirSubcategorias(content.include_subcategories, 'products_grid'))
    const ordenados = ordenarListado(filtrados, content.sort_order)
    return content.exclude_out_of_stock === true ? ordenados.filter((p: any) => !isOutOfStock(p)) : ordenados
  }, [desdeServidor, todos, productosCategoria, categorias, content.selected_category_ids, content.include_subcategories, content.sort_order, content.exclude_out_of_stock])

  const filtros = useFiltrosProductos(base, () => setVisibles(POR_TANDA))
  const cats = useMemo(() => categoriasDisponibles(base, categorias, content.selected_category_ids), [base, categorias, content.selected_category_ids])
  const tope = topeProductos(content)
  const filtrados = filtros.filtrados
  const cupo = desdeServidor ? filtrados.length : tope ?? visibles
  const mostrados = filtrados.slice(0, cupo)
  const hayMas = !desdeServidor && tope === null && filtrados.length > mostrados.length

  // Conteo real: con filtros del visitante, lo filtrado; sin ellos, el total del servidor cuando
  // describe exactamente esta lista (sin categorías ni agotados elegidos), si no, lo cargado.
  const sinSeleccion = !(content.selected_category_ids?.length) && content.exclude_out_of_stock !== true
  const conteo = filtros.activos
    ? filtrados.length
    : desdeServidor || (sinSeleccion && totalServidor !== null && totalServidor > base.length)
      ? totalServidor ?? base.length
      : base.length

  if (todos.length === 0) {
    return (
      <EditorHint title={error ? 'No pudimos cargar los productos' : 'Rejilla sin productos'}>
        {error ? 'Intenta de nuevo en unos segundos.' : 'Publica productos activos para verlos aquí.'}
      </EditorHint>
    )
  }

  const titulo = typeof content.title === 'string' ? content.title.trim() : ''
  const subtitulo = typeof content.subtitle === 'string' ? content.subtitle.trim() : ''
  const estiloTarjeta = content.product_card_style && typeof content.product_card_style === 'object' ? { ...content, ...content.product_card_style } : content
  const mostrarFiltros = content.show_filters !== false && cats.length > 1
  const chips = ajustes.filtersStyle === 'chips'
  const linea = 'color-mix(in srgb, currentColor 15%, transparent)'

  // Productos con las tarjetas editoriales en su lugar (después del producto `after`).
  const celdas: Array<{ tipo: 'producto'; producto: any } | { tipo: 'editorial'; tarjeta: TarjetaEditorial }> = []
  const porPosicion = new Map(ajustes.editorialCards.map((t) => [t.after, t]))
  mostrados.forEach((p, i) => {
    const antes = porPosicion.get(i)
    if (antes) celdas.push({ tipo: 'editorial', tarjeta: antes })
    celdas.push({ tipo: 'producto', producto: p })
  })
  const alFinal = porPosicion.get(mostrados.length)
  if (alFinal && !hayMas) celdas.push({ tipo: 'editorial', tarjeta: alFinal })

  return (
    <div>
      {(titulo || subtitulo || ajustes.countHeader) && (
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          {titulo ? (
            <h2 className="titulo-legado text-4xl leading-none md:text-7xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
              {titulo}
            </h2>
          ) : (
            <span />
          )}
          <div className="md:text-right">
            {subtitulo && <p className="titulo-legado text-lg italic" style={{ fontFamily: 'var(--font-heading, inherit)' }}>{subtitulo}</p>}
            {ajustes.countHeader && (
              <p className="text-sm opacity-60" aria-live="polite">
                {conteo === 1 ? '1 producto' : `${conteo.toLocaleString('es-CO')} productos`}
              </p>
            )}
          </div>
        </div>
      )}

      {mostrarFiltros && (
        <div className="mb-8 flex flex-col gap-3 border-y py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: linea }}>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-hide" role="group" aria-label="Filtrar por categoría">
            {[{ id: null as number | null, name: 'Todo' }, ...cats.map((c: any) => ({ id: Number(c.id) as number | null, name: String(c.name ?? '') }))].map((c) => {
              const activa = filtros.estado.categoria === c.id
              return (
                <button
                  key={c.id ?? 'todo'}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => filtros.cambiar({ categoria: c.id })}
                  className={`shrink-0 whitespace-nowrap text-sm transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                    chips ? `rounded-full border px-4 py-1.5 ${activa ? 'border-current' : 'border-transparent'}` : 'px-2 py-1.5'
                  } ${activa ? 'opacity-100' : 'opacity-55 hover:opacity-100'}`}
                >
                  {c.name}
                </button>
              )
            })}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <span className="opacity-60">Ordenar</span>
            <select
              value={filtros.estado.orden}
              onChange={(e) => filtros.cambiar({ orden: e.target.value as OrdenFiltro })}
              className="bg-transparent py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
            >
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {mostrados.length > 0 ? (
        <ul className={clasesColumnasProductos(content.columns)} style={separacion}>
          {celdas.map((c) =>
            c.tipo === 'producto' ? (
              <li key={`p-${c.producto.id}`}>
                <ProductCard
                  product={c.producto}
                  primaryColor={primaryColor}
                  variant="grid"
                  cardStyle={estiloTarjeta}
                  badges={content.badges}
                  cardButtons={content.card_buttons}
                  buttonsPosition={content.buttons_position}
                  buttonsLayout={content.buttons_layout}
                  buttonsFullWidth={content.buttons_full_width !== false}
                  iconOnly={content.icon_only}
                  showBuyNow={mostrarComprarYa}
                  organizationSubdomain={subdominio}
                  branchId={branchId}
                />
              </li>
            ) : (
              <li key={`e-${c.tarjeta.after}`} className={ANCHO_EDITORIAL[c.tarjeta.span]}>
                <TarjetaEditorialVista tarjeta={c.tarjeta} />
              </li>
            ),
          )}
        </ul>
      ) : (
        <div className="py-12 text-center text-sm opacity-70">
          <p>No hay productos con estos filtros.</p>
          <button type="button" onClick={filtros.limpiar} className="mt-2 underline underline-offset-2">
            Limpiar filtros
          </button>
        </div>
      )}

      {hayMas && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibles((v) => v + POR_TANDA)}
            className="min-h-[44px] border px-6 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            style={{ borderColor: 'currentColor', borderRadius: 'var(--radio-boton, 0px)' }}
          >
            Ver más
          </button>
        </div>
      )}
    </div>
  )
}

function TarjetaEditorialVista({ tarjeta }: { tarjeta: TarjetaEditorial }) {
  const cuerpo = (
    <>
      {tarjeta.imageUrl && <img src={tarjeta.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      <div className={`relative flex h-full flex-col justify-end p-6 md:p-8 ${tarjeta.imageUrl ? 'bg-gradient-to-t from-black/45 via-black/10 to-transparent text-white' : ''}`}>
        {tarjeta.title && (
          <h3 className="text-2xl italic leading-tight md:text-4xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
            {tarjeta.title}
          </h3>
        )}
        {tarjeta.text && <p className="mt-2 max-w-md text-sm opacity-90">{tarjeta.text}</p>}
        {tarjeta.url && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm">
            Ver más
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  )
  const clase = 'relative block h-full min-h-[320px] overflow-hidden bg-black/5'
  const estilo = { borderRadius: 'var(--radio-sitio, 0px)' }
  return tarjeta.url ? (
    <a href={tarjeta.url} className={`${clase} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`} style={estilo}>
      {cuerpo}
    </a>
  ) : (
    <div className={clase} style={estilo}>
      {cuerpo}
    </div>
  )
}
