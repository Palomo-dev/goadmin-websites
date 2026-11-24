/**
 * F9.4 — Sección category_header.
 *
 * Renderiza la cabecera de categoría: título, descripción, imagen de portada
 * y breadcrumb. Reproduce exactamente el layout hardcodeado actual cuando
 * no hay configuración personalizada (cero regresión).
 */

import { disposicionEncabezadoCategoria } from '@/lib/website/v2/contrato/seccionesTienda'
import { navegacionCategoria } from '@/lib/navegacion/volver'
import { BotonVolver } from '@/components/site/volver/BotonVolver'
import { MigasTienda } from '@/components/site/volver/EncabezadoPagina'

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

export function CategoryHeader({ content, primaryColor, data }: CategoryHeaderProps) {
  const category = data?.category
  if (!category) return null

  const parentCategory = data?.parentCategory
  const total = data?.total ?? 0
  const showImage = content.show_image !== false
  const showBreadcrumb = content.show_breadcrumb !== false
  const showCount = content.show_count !== false
  // `split_text` solo cambia el bloque de texto (sin foto de portada); `stack` = lo de hoy.
  const partido = disposicionEncabezadoCategoria(content as Record<string, unknown>) === 'split_text'
  // «Volver» (Figma 2992:74856): Inicio › categoría padre › categoría; el ← va a la padre o al inicio.
  const nav = navegacionCategoria({ categoria: category.name, padre: parentCategory ?? null })
  const conPortada = showImage && Boolean(category.image_url)
  /** ← cuadrado junto al título (escritorio). */
  const volver = <span className="hidden md:inline-flex" data-volver-titulo=""><BotonVolver padre={nav.padre} primaryColor={primaryColor} /></span>

  return (
    <div className="mb-8">
      {/* Migas (escritorio; en el celular va la barra «← Volver a …»). Con portada, el título va
          dentro de la foto y el ← al inicio de las migas (Figma 2992:74983). */}
      {(showBreadcrumb || conPortada) && (
        <div className="mb-6 hidden items-center gap-3 md:flex" style={{ ['--volver-miga' as string]: primaryColor }} data-volver-migas="">
          {conPortada && <BotonVolver padre={nav.padre} primaryColor={primaryColor} />}
          {showBreadcrumb && <MigasTienda migas={nav.migas} />}
        </div>
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
            <div className="flex items-center gap-3.5" data-volver-fila="">
              {volver}
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white">{category.name}</h1>
            </div>
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
          <div className="flex items-center gap-3.5" data-volver-fila="">
            {volver}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{category.name}</h1>
          </div>
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
