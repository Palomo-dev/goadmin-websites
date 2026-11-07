/**
 * F9.4 — Sección category_header.
 *
 * Renderiza la cabecera de categoría: título, descripción, imagen de portada
 * y breadcrumb. Reproduce exactamente el layout hardcodeado actual cuando
 * no hay configuración personalizada (cero regresión).
 */

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { EnlaceSitio } from '@/components/site/EnlaceSitio'
import { disposicionEncabezadoCategoria } from '@/lib/website/v2/contrato/seccionesTienda'

export const CONTENT_KEYS = ['show_image', 'show_breadcrumb', 'show_count', 'layout'] as const

interface CategoryHeaderProps {
  content: {
    show_image?: boolean
    show_breadcrumb?: boolean
    show_count?: boolean
    /** `split_text` (plantillas de tienda): título a la izquierda y texto a la derecha. Ausente = `stack`. */
    layout?: string
  }
  primaryColor?: string
  data?: {
    category?: any
    parentCategory?: any
    total?: number
  }
}

export function CategoryHeader({ content, data }: CategoryHeaderProps) {
  const category = data?.category
  if (!category) return null

  const parentCategory = data?.parentCategory
  const total = data?.total ?? 0
  const showImage = content.show_image !== false
  const showBreadcrumb = content.show_breadcrumb !== false
  const showCount = content.show_count !== false
  // `split_text` solo cambia el bloque de texto (sin foto de portada); `stack` = lo de hoy.
  const partido = disposicionEncabezadoCategoria(content as Record<string, unknown>) === 'split_text'

  return (
    <div className="mb-8">
      {showBreadcrumb && (
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6 overflow-x-auto">
          <Link href="/" className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
            <Home className="h-4 w-4" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <EnlaceSitio href="/productos" className="hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
            Productos
          </EnlaceSitio>
          {parentCategory && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <Link href={`/categorias/${parentCategory.slug}`} className="hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
                {parentCategory.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white truncate">{category.name}</span>
        </nav>
      )}

      {showImage && category.image_url && (
        <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden mb-6">
          <img
            src={category.image_url}
            alt={category.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white">{category.name}</h1>
            {category.description && (
              <p className="text-white/80 mt-2 max-w-2xl">{category.description}</p>
            )}
          </div>
        </div>
      )}

      {(!showImage || !category.image_url) && partido && (
        <div className="grid gap-4 md:grid-cols-2 md:items-end md:gap-12">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white">{category.name}</h1>
            {showCount && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                {total} {total === 1 ? 'producto' : 'productos'}
              </p>
            )}
          </div>
          {category.description && (
            <p className="text-gray-600 dark:text-gray-400 md:text-lg max-w-xl md:justify-self-end">{category.description}</p>
          )}
        </div>
      )}

      {(!showImage || !category.image_url) && !partido && (
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{category.name}</h1>
          {category.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">{category.description}</p>
          )}
        </div>
      )}

      {showCount && !(partido && (!showImage || !category.image_url)) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
          {total} {total === 1 ? 'producto' : 'productos'}
        </p>
      )}
    </div>
  )
}
