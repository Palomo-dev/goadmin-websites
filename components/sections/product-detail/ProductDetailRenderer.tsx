/**
 * ProductDetailRenderer (F9.2)
 *
 * Orquesta la renderización del detalle de producto:
 *  1. Busca la plantilla `product_detail` de la organización.
 *  2. Si tiene secciones → las renderiza con datos del producto.
 *  3. Si no tiene secciones → renderiza los bloques por defecto
 *     (`buildDefaultProductDetailSections(page_settings)`), que pintan lo mismo que el layout
 *     monolítico de antes (fase 1 de la PDP personalizable; verify:ficha-diff lo compara al píxel).
 *
 * Un solo layout para los dos casos:
 *  - `page_settings.columns === '1'`: todo apilado (`space-y-12`).
 *  - Si no, dos columnas: la galería y lo que va ANTES de ella en el orden van en la columna de
 *    la galería; lo que va después, en la columna de información (`sticky_column`).
 *  - `related_products` y `product_reviews` van a todo el ancho, debajo, en su orden.
 *  - El marcador `product_urgency` (aviso de stock bajo + contador) se resuelve aquí; sin
 *    marcador, la urgencia va justo después de `product_info`.
 *
 * Los bloques de ficha sin `settings` (estilo por sección) se pintan directo, sin
 * SectionWrapper: el wrapper agrega `<section>` con relleno de sección y un bloque vacío
 * (p. ej. beneficios en un restaurante) dejaba hueco. Con `settings` pasan por SectionRenderer
 * como cualquier sección (estilo y visibilidad por dispositivo).
 *
 * La lógica transaccional (checkout, pagos) NO se expone aquí.
 */

import Link from 'next/link'
import type React from 'react'
import { ArrowLeft } from 'lucide-react'
import { SectionRenderer, SECTION_MAP } from '@/components/sections/SectionRenderer'
import { ContadorColumnas } from '@/components/site/ContadorColumnas'
import { soloContador } from '@/lib/website/contadorColumnas'
import { ContadoresDe } from '@/components/site/ContadorPublico'
import { avisoStock, conversionManda, type ConversionSitio } from '@/lib/website/conversion'
import type { OrganizationWithDetails } from '@/types/database'
import type { WebsitePageWithSections, WebsitePageSection } from '@/types/database'
import { buildDefaultProductDetailSections, TIPO_URGENCIA_FICHA } from '@/lib/defaultProductDetailSections'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import type { OrdenAtributos } from '@/lib/products/ordenAtributos'

function stockReal(product: { track_stock?: boolean | null; stock_levels?: { qty_on_hand?: number | null }[] | null }): number | null {
  if (!product?.track_stock || !Array.isArray(product.stock_levels)) return null
  return product.stock_levels.reduce((suma, nivel) => suma + Number(nivel?.qty_on_hand || 0), 0)
}

/** Bloques propios de la ficha: sin estilo por sección se pintan sin SectionWrapper. */
const TIPOS_BLOQUE_FICHA = new Set([
  'product_gallery', 'product_info', 'product_actions', 'product_benefits', 'product_description',
  'related_products', 'product_reviews', 'product_specs', 'product_faq', 'product_shipping',
])
/** Tipos que van a todo el ancho, debajo de las columnas. */
const TIPOS_ANCHO_COMPLETO = new Set(['related_products', 'product_reviews'])

interface ProductDetailRendererProps {
  organization: OrganizationWithDetails
  primaryColor: string
  templatePage: WebsitePageWithSections | null
  product: any
  variants: any[]
  modifierGroups: any[]
  relatedProducts: any[]
  imageUrls: string[]
  imageUrl: string | null
  price: any
  comparePrice: number | null
  isParent: boolean
  branchId?: number | null
  /** Modo restaurante (type_id = 1): ficha de plato, sin beneficios de e-commerce por defecto. */
  restaurante?: { textoAgotado: string | null } | null
  puedePedir?: boolean
  /** `''` o `'/sede-norte'` (sede servida por prefijo de ruta): «Volver a la carta» de la sede. */
  prefijoSede?: string
  /** Orden del catálogo de variantes (`variant_values.display_order`). */
  ordenAtributos?: OrdenAtributos | null
}

export function ProductDetailRenderer({
  organization,
  primaryColor,
  templatePage,
  product,
  variants,
  modifierGroups,
  relatedProducts,
  imageUrls,
  imageUrl,
  price,
  comparePrice,
  isParent,
  branchId = null,
  restaurante = null,
  puedePedir = true,
  prefijoSede = '',
  ordenAtributos = null,
}: ProductDetailRendererProps) {
  const volver = restaurante
    ? { href: conPrefijo('/menu', prefijoSede), texto: 'Volver a la carta' }
    : { href: conPrefijo('/productos', prefijoSede), texto: 'Volver a productos' }
  const hasSections = Boolean(templatePage && templatePage.website_page_sections.length > 0)

  const reviewsConfig = (organization.website_settings as any)?.product_reviews ?? null
  const productStats = { rating_avg: product.rating_avg, reviews_count: product.reviews_count }

  // F9.3 — Ajustes de layout de la página
  const pageSettings = (templatePage?.page_settings || {}) as Record<string, any>
  const columns = pageSettings.columns || '2' // '1' | '2' | '2+sidebar'
  const stickyColumn = pageSettings.sticky_column !== false // default true
  const galleryWidth = pageSettings.gallery_width ?? 50
  const showBreadcrumb = pageSettings.show_breadcrumb !== false

  // ---- Datos compartidos para las secciones ----
  const sectionData: Record<string, any> = {
    product,
    variants,
    modifierGroups,
    relatedProducts,
    imageUrls,
    imageUrl,
    price: price ? Number(price.price) : 0,
    /** Hay fila de precio vigente (el precio de la ficha solo se pinta con ella). */
    tienePrecio: Boolean(price),
    comparePrice,
    isParent,
    organization,
    organizationSubdomain: organization.subdomain || '',
    trackStock: product.track_stock,
    stockLevels: product.stock_levels,
    reviewsConfig,
    productStats,
    branchId,
    restaurante,
    puedePedir,
    ordenAtributos,
  }

  // ---- Urgencia: aviso de stock bajo + contador (igual que el layout de antes) ----
  const ajustesProducto = organization.website_settings as { conversion?: ConversionSitio } | null
  const stockProducto = stockReal(product)
  const stockBajo = ajustesProducto?.conversion?.urgencia?.stockBajo
  const avisoProducto = stockBajo?.activo && stockBajo.ubicaciones?.includes('producto')
    ? avisoStock(stockProducto, stockBajo.umbral, stockBajo.plantilla)
    : null
  const countdownBlock = conversionManda(ajustesProducto, 'producto') ? (
    <ContadoresDe settings={ajustesProducto} ubicacion="producto" primaryColor={primaryColor} variante="inline" />
  ) : (
    <ContadorColumnas settings={soloContador(organization.website_settings)} columna="countdown_show_in_product" primaryColor={primaryColor} variant="inline" />
  )
  const urgencia = (clave: string) => (
    <UrgenciaFicha key={clave} aviso={avisoProducto} contador={countdownBlock} />
  )

  // ---- Secciones: las de la plantilla o los bloques por defecto ----
  const secciones = hasSections && templatePage
    ? templatePage.website_page_sections
    : buildDefaultProductDetailSections(pageSettings)
  const visibles = secciones.filter((s) => s.is_visible !== false)
  const conMarcador = visibles.some((s) => s.section_type === TIPO_URGENCIA_FICHA)

  const principales = visibles.filter((s) => !TIPOS_ANCHO_COMPLETO.has(s.section_type))
  const anchoCompleto = visibles.filter((s) => TIPOS_ANCHO_COMPLETO.has(s.section_type))
  const idPrimera = [...principales, ...anchoCompleto].find((s) => s.section_type !== TIPO_URGENCIA_FICHA)?.id

  const renderSection = (section: WebsitePageSection): React.ReactNode => {
    if (section.section_type === TIPO_URGENCIA_FICHA) return urgencia(section.id)
    const settings = (section.settings || {}) as Record<string, unknown>
    const Bloque = SECTION_MAP[section.section_type]?.[section.section_variant]
    const nodo = Bloque && TIPOS_BLOQUE_FICHA.has(section.section_type) && Object.keys(settings).length === 0 ? (
      <Bloque
        key={section.id}
        content={(section.content || {}) as Record<string, any>}
        organization={organization}
        primaryColor={primaryColor}
        data={sectionData}
        sectionVariant={section.section_variant}
        sectionId={section.id}
      />
    ) : (
      <SectionRenderer
        key={section.id}
        section={section}
        organization={organization}
        primaryColor={primaryColor}
        data={sectionData}
        isFirst={section.id === idPrimera}
      />
    )
    // Plantilla sin marcador: la urgencia va justo después de la información.
    const urgenciaTrasInfo = !conMarcador && section.section_type === 'product_info'
      && (section.content as Record<string, unknown> | null)?.show_countdown !== false
    return urgenciaTrasInfo ? [nodo, urgencia(`${section.id}__urgencia`)] : nodo
  }

  // Breadcrumb
  const breadcrumbBlock = showBreadcrumb && (
    <div className="mb-8">
      <Link
        href={volver.href}
        className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {volver.texto}
      </Link>
    </div>
  )

  // Layout según columns
  const layoutGrid = (() => {
    if (columns === '1') {
      return (
        <div className="space-y-12">
          {principales.map(renderSection)}
        </div>
      )
    }

    // columns === '2' o '2+sidebar': la galería y lo anterior a ella, en la columna de la galería.
    const iGaleria = principales.findIndex((s) => s.section_type === 'product_gallery')
    const columnaGaleria = iGaleria >= 0 ? principales.slice(0, iGaleria + 1) : []
    const columnaInfo = iGaleria >= 0 ? principales.slice(iGaleria + 1) : principales
    const galleryStyle = { flexBasis: `${galleryWidth}%` } as React.CSSProperties
    const infoStyle = { flexBasis: `${100 - galleryWidth}%` } as React.CSSProperties

    return (
      <div className="flex flex-col lg:flex-row gap-12">
        <div style={galleryStyle} className="space-y-3">
          {columnaGaleria.map(renderSection)}
        </div>
        <div style={infoStyle} className="min-w-0">
          <div className={`space-y-6 ${stickyColumn ? 'lg:sticky lg:top-4 lg:self-start' : ''}`}>
            {columnaInfo.map(renderSection)}
          </div>
        </div>
      </div>
    )
  })()

  return (
    <div className="container mx-auto px-4 py-12">
      {breadcrumbBlock}
      {layoutGrid}

      {/* Productos relacionados y reseñas, a todo el ancho */}
      {anchoCompleto.map(renderSection)}
    </div>
  )
}

/** Aviso de stock bajo y contador: dos hermanos sueltos en la columna, como antes. */
function UrgenciaFicha({ aviso, contador }: { aviso: string | null; contador: React.ReactNode }) {
  return (
    <>
      {aviso && <p className="text-sm font-medium text-orange-600">{aviso}</p>}
      {contador}
    </>
  )
}
