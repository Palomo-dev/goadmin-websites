'use client'

import Image from 'next/image'
import { Package } from 'lucide-react'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { textoPlano } from '@/lib/texto/textoPlano'
import { mostrarPrecioAnterior, precioAnteriorValido } from '@/lib/products/precioAnterior'
import { PrecioAnterior } from '@/components/site/PrecioAnterior'
import { BarraFiltrosProductos, SinResultadosFiltros, useFiltrosProductos } from './BarraFiltrosProductos'
import { categoriasDisponibles } from '@/lib/products/filtrosProductos'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary)
  const image = primary || product.product_images[0]
  const path = image.storage_path || image.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

function getPrice(product: any): number | null {
  if (product.product_prices && product.product_prices.length > 0) {
    return Number(product.product_prices[0].price)
  }
  return null
}

function getComparePrice(product: any): number | null {
  return precioAnteriorValido(product.product_prices?.[0]?.compare_price, getPrice(product))
}

interface FeaturedProductsHeroProps {
  content: Record<string, any>
  primaryColor?: string
  data?: { products?: any[]; categories?: any[] }
}

export function FeaturedProductsHero({ content, primaryColor = '#3B82F6', data }: FeaturedProductsHeroProps) {
  const { ruta } = useRutaSitio()
  const title = content.title || 'Productos Destacados'
  const allProducts = data?.products || []
  const maxItems = content.max_items || 5
  // «Mostrar descripción» del inspector. Ausente = se muestra, como antes de leerlo.
  const showDescription = content.show_description !== false
  // «Mostrar precio tachado». Ausente = sin precio anterior, como antes de leerlo.
  const showCompare = mostrarPrecioAnterior(content)
  // Filtros y buscador del visitante sobre los ya cargados; el límite (y el principal) va después.
  const filtros = useFiltrosProductos(allProducts)
  const products = filtros.filtrados.slice(0, maxItems)
  const hero = products[0]
  const rest = products.slice(1)

  // «Mostrar filtros» y «Mostrar buscador»: ausentes = sin barra, como antes de leerlos.
  const barra = allProducts.length > 0 && (
    <BarraFiltrosProductos
      categorias={categoriasDisponibles(allProducts, data?.categories, content.selected_category_ids)}
      estado={filtros.estado}
      cambiar={filtros.cambiar}
      total={filtros.filtrados.length}
      primaryColor={primaryColor}
      mostrarFiltros={content.show_filters === true}
      mostrarBuscador={content.show_search === true}
      mostrarCategorias={content.show_categories !== false}
    />
  )

  if (!hero && filtros.activos) {
    return (
      <div>
        {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
        {barra}
        <SinResultadosFiltros onLimpiar={filtros.limpiar} primaryColor={primaryColor} />
      </div>
    )
  }

  if (!hero) {
    return (
      <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
        <p className="text-4xl mb-3">⭐</p>
        <p>No hay productos destacados aún</p>
      </div>
    )
  }

  const heroImg = getImageUrl(hero)
  const heroPrice = getPrice(hero)
  const heroCompare = showCompare ? getComparePrice(hero) : null

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">{title}</h2>}
      {barra}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Producto principal */}
        <a href={ruta(`/productos/${hero.uuid}`)} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
            {heroImg ? (
              <Image src={heroImg} alt={hero.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 1024px) 100vw, 50vw" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-20 w-20 text-gray-300 dark:text-gray-500" />
              </div>
            )}
          </div>
          <div className="p-6">
            <h3 className="font-bold text-xl mb-2 text-gray-900 dark:text-white">{hero.name}</h3>
            {showDescription && textoPlano(hero.description) && <p className="text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">{textoPlano(hero.description)}</p>}
            {heroPrice !== null && heroCompare !== null && (
              <PrecioAnterior className="text-lg mr-2">${heroCompare.toLocaleString('es-CO')}</PrecioAnterior>
            )}
            {heroPrice !== null && (
              <span className="font-bold text-2xl" style={{ color: primaryColor }}>${heroPrice.toLocaleString('es-CO')}</span>
            )}
          </div>
        </a>
        {/* Grid secundario */}
        <div className="grid grid-cols-2 gap-4">
          {rest.map((product: any) => {
            const imgUrl = getImageUrl(product)
            const price = getPrice(product)
            const compare = showCompare && price !== null ? getComparePrice(product) : null
            return (
              <a key={product.id} href={ruta(`/productos/${product.uuid}`)} className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                  {imgUrl ? (
                    <Image src={imgUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="25vw" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-gray-300 dark:text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</h3>
                  {compare !== null && (
                    <PrecioAnterior className="text-xs mr-1.5">${compare.toLocaleString('es-CO')}</PrecioAnterior>
                  )}
                  {price !== null && (
                    <span className="font-bold text-sm" style={{ color: primaryColor }}>${price.toLocaleString('es-CO')}</span>
                  )}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
