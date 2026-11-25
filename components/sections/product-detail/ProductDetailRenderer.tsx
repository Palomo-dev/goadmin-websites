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
 * Plantillas de tienda (paquete W4; todo inerte sin sus claves o bloques):
 *  - Sin `page_settings` (V2), `product_gallery.contenido.page_layout` decide columnas, columna
 *    fija, ancho de la galería y migas (`resolverDisenoFicha`). Con `page_settings` (legacy), lo
 *    de siempre. Sin `page_layout`, los defaults de hoy.
 *  - Bloques nuevos: `product_anchor_nav` (pestañas de la ficha), `product_pager` (anterior y
 *    siguiente) y `complete_the_look`. Sus datos (vecinos, productos del look, zonas de envío) los
 *    consulta la página solo si el bloque está, y llegan en `extrasFicha`.
 *  - Pestañas de la ficha (Figma «Ficha — pestañas reales» 3255-99475, 2026-11-25): los bloques
 *    con pestaña (Descripción, Características, Envío y devoluciones, Reseñas, Preguntas) salen de
 *    su columna y se pintan en los paneles, debajo de las dos columnas y a todo el ancho
 *    (`planPestanasFicha`). «Envío y devoluciones» deja junto al botón una línea corta con los
 *    datos reales de la tienda. Sin el bloque de pestañas, el marcado es el de hoy.
 *
 * Los bloques de ficha sin `settings` (estilo por sección) se pintan directo, sin
 * SectionWrapper: el wrapper agrega `<section>` con relleno de sección y un bloque vacío
 * (p. ej. beneficios en un restaurante) dejaba hueco. Con `settings` pasan por SectionRenderer
 * como cualquier sección (estilo y visibilidad por dispositivo).
 *
 * La lógica transaccional (checkout, pagos) NO se expone aquí.
 */

import type React from 'react'
import { configResenasSitio } from '@/lib/resenas/ajustesResenas'
import { EncabezadoPagina } from '@/components/site/volver/EncabezadoPagina'
import type { DestinoPadre, Miga } from '@/lib/navegacion/volver'
import { SectionRenderer, SECTION_MAP } from '@/components/sections/SectionRenderer'
import { buildSurfaceStyle } from '@/lib/sectionStyle'
import { ColumnaInfoFija } from '@/components/sections/product-detail/ColumnaInfoFija'
import { ContadorColumnas } from '@/components/site/ContadorColumnas'
import { soloContador } from '@/lib/website/contadorColumnas'
import { ContadoresDe } from '@/components/site/ContadorPublico'
import { avisoStock, conversionManda, type ConversionSitio } from '@/lib/website/conversion'
import type { OrganizationWithDetails } from '@/types/database'
import type { WebsitePageWithSections, WebsitePageSection } from '@/types/database'
import { buildDefaultProductDetailSections, TIPO_URGENCIA_FICHA } from '@/lib/defaultProductDetailSections'
import type { OrdenAtributos } from '@/lib/products/ordenAtributos'
import {
  TIPOS_ANCHO_COMPLETO_TIENDA,
  TIPOS_BLOQUE_FICHA_TIENDA,
  planPestanasFicha,
  resolverDisenoFicha,
  sinEnvioRepetidoDeFabrica,
  type PaginadorFichaDatos,
} from './fichaTienda'
import type { RelacionadosFichaDatos } from './RelatedProductsSection'
import { resumenEnvioFicha, type PromesaZona } from './anclasFicha'
import type { DatosPestanasFicha } from './NavAnclas'
import { configResenasDeSeccion } from '@/components/site/reviews/types'
import { ProveedorEtiquetasFicha } from '@/components/site/etiquetas/EtiquetasFicha'
import { leerOpcionesEtiquetasFicha } from '@/lib/website/v2/seccionesFicha'
import { isOutOfStock } from '@/lib/stock'
import { isParentProduct, padreSinVariantes } from '@/lib/products/datosTarjeta'

function stockReal(product: { track_stock?: boolean | null; stock_levels?: { qty_on_hand?: number | null }[] | null }): number | null {
  if (!product?.track_stock || !Array.isArray(product.stock_levels)) return null
  return product.stock_levels.reduce((suma, nivel) => suma + Number(nivel?.qty_on_hand || 0), 0)
}

/** Bloques propios de la ficha: sin estilo por sección se pintan sin SectionWrapper. */
const TIPOS_BLOQUE_FICHA = new Set<string>([
  'product_gallery', 'product_info', 'product_actions', 'product_benefits', 'product_description',
  'related_products', 'product_reviews', 'product_specs', 'product_faq', 'product_shipping',
  ...TIPOS_BLOQUE_FICHA_TIENDA,
])
/** Tipos que van a todo el ancho, debajo de las columnas. */
const TIPOS_ANCHO_COMPLETO = new Set<string>(['related_products', 'product_reviews', ...TIPOS_ANCHO_COMPLETO_TIENDA])

/**
 * Datos de los bloques nuevos de las plantillas de tienda. La página solo los consulta si la
 * plantilla trae el bloque; ausentes, los bloques no se pintan.
 */
export interface ExtrasFicha {
  /** `product_pager`: vecinos en el orden de la categoría. */
  paginador?: PaginadorFichaDatos | null
  /** `complete_the_look`: productos que se llevan con este. */
  look?: any[] | null
  /** `product_specs · icon_grid/panel`, fila «Categoría». */
  categoria?: { name: string; slug?: string | null } | null
  /** `related_products`: elegidos a mano y comprados juntos (solo si la sección los pide). */
  relacionados?: RelacionadosFichaDatos | null
  /** Zonas de envío activas (promesa y envío gratis): resumen de envío junto al botón. */
  zonasEnvio?: PromesaZona[] | null
}

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
  /** `''` o `'/sede-norte'` (sede servida por prefijo de ruta): enlaces de los bloques de la sede. */
  prefijoSede?: string
  /** Orden del catálogo de variantes (`variant_values.display_order`). */
  ordenAtributos?: OrdenAtributos | null
  /** Plantillas de tienda: datos de los bloques nuevos (ver {@link ExtrasFicha}). */
  extrasFicha?: ExtrasFicha | null
  /** Número de WhatsApp del sitio: «Pedir por WhatsApp» de los botones de compra. */
  whatsapp?: string | null
  /** Migas y ← de la ficha (lib/navegacion/volver, `navegacionFicha`). Sin ellas, Inicio › Productos/Carta. */
  navegacion?: { padre: DestinoPadre; migas: Miga[] } | null
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
  extrasFicha = null,
  whatsapp = null,
  navegacion = null,
}: ProductDetailRendererProps) {
  // Padre del ← sin `navegacion`: la carta o Productos, como el «Volver a …» de antes. Las rutas van
  // sin prefijo: EncabezadoPagina antepone el de la sede.
  const padreVolver: DestinoPadre = navegacion?.padre
    ?? (restaurante ? { href: '/menu', etiqueta: 'la carta' } : { href: '/productos', etiqueta: 'Productos' })
  const migasVolver: Miga[] = navegacion?.migas
    ?? [{ etiqueta: 'Inicio', href: '/' }, { etiqueta: restaurante ? 'Carta' : 'Productos', href: padreVolver.href }, { etiqueta: String(product?.name ?? '') }]
  const hasSections = Boolean(templatePage && templatePage.website_page_sections.length > 0)

  // Origen y ajustes de reseñas de la tienda (lib/resenas): sin ellos, el `null` de siempre.
  const reviewsConfig = configResenasSitio(organization.website_settings)
  const productStats = { rating_avg: product.rating_avg, reviews_count: product.reviews_count }

  // F9.3 — Ajustes de layout de la página
  const pageSettings = (templatePage?.page_settings || {}) as Record<string, any>

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
    whatsapp,
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
  const crudas = secciones.filter((s) => s.is_visible !== false)
  // Pestañas de la ficha: qué bloques pasan a los paneles (null = sin bloque de pestañas).
  const planPestanas = planPestanasFicha(crudas)
  const envioEnPestana = planPestanas?.items.find((i) => i.target === 'product_shipping')?.seccion ?? null
  // «Envío y devoluciones» sin tocar + «Beneficios» de fábrica repiten los mismos datos: se pinta
  // uno (ver `sinEnvioRepetidoDeFabrica`). Con cualquiera de los dos configurado, los dos. Con
  // «Envío y devoluciones» en su pestaña, los dos: arriba solo queda la línea corta.
  const visibles = envioEnPestana ? crudas : sinEnvioRepetidoDeFabrica(crudas, { restaurante: Boolean(restaurante) })
  const conMarcador = visibles.some((s) => s.section_type === TIPO_URGENCIA_FICHA)

  // Columnas, columna fija, ancho de galería y migas: `page_settings` (legacy) como siempre; sin
  // él (V2), el `page_layout` de la galería; sin `page_layout`, los defaults de hoy.
  const { columns, stickyColumn, galleryWidth, showBreadcrumb } = resolverDisenoFicha(templatePage?.page_settings ?? null, secciones)

  // Plantillas de tienda: datos de los bloques nuevos, solo si la página los trae.
  if (envioEnPestana) {
    // Línea corta de envío junto al botón: datos reales de la tienda (sin datos, no sale).
    const ajustesEnvio = organization.website_settings as { enable_shipping?: boolean | null; free_shipping_threshold?: unknown } | null
    sectionData.resumenEnvio = resumenEnvioFicha({
      envioActivo: ajustesEnvio?.enable_shipping !== false,
      umbralSitio: ajustesEnvio?.free_shipping_threshold,
      zonas: extrasFicha?.zonasEnvio ?? null,
    })
  } else {
    // Sin pestaña de envío: el bloque de siempre.
  }
  if (extrasFicha) {
    sectionData.paginadorFicha = extrasFicha.paginador ?? null
    sectionData.lookFicha = extrasFicha.look ?? []
    sectionData.categoriaFicha = extrasFicha.categoria ?? null
    sectionData.relacionadosFicha = extrasFicha.relacionados ?? null
    sectionData.prefijoSede = prefijoSede
  } else {
    // Sin extras: los datos de siempre.
  }
  // Descripción con «Preguntas frecuentes»: las del bloque `product_faq` de la plantilla, si lo hay.
  const bloqueFaq = visibles.find((s) => s.section_type === 'product_faq')
  sectionData.faqFicha = Array.isArray((bloqueFaq?.content as Record<string, unknown> | null)?.items)
    ? ((bloqueFaq?.content as Record<string, unknown>).items as unknown[])
    : null
  // Con pestañas: los bloques que van en un panel salen de su sitio (el de envío se queda, con la
  // línea corta) y el bloque de pestañas se pinta debajo de las dos columnas.
  const enPanel = new Set<string>(
    (planPestanas?.items ?? []).filter((i) => i.target !== 'product_shipping').map((i) => i.seccion.id),
  )
  const fueraDeColumnas = (s: WebsitePageSection) => enPanel.has(s.id) || (planPestanas !== null && s.id === planPestanas.nav.id)

  const principales = visibles.filter((s) => !TIPOS_ANCHO_COMPLETO.has(s.section_type) && !fueraDeColumnas(s))
  const anchoCompleto = visibles.filter((s) => TIPOS_ANCHO_COMPLETO.has(s.section_type) && !fueraDeColumnas(s))
  const idPrimera = [...principales, ...anchoCompleto].find((s) => s.section_type !== TIPO_URGENCIA_FICHA)?.id

  /** `extra`: datos solo de este bloque (en su panel, la línea corta de envío, los paneles). */
  const renderSection = (section: WebsitePageSection, extra?: Record<string, unknown>): React.ReactNode => {
    if (section.section_type === TIPO_URGENCIA_FICHA) return urgencia(section.id)
    const settings = (section.settings || {}) as Record<string, unknown>
    const datosBloque = extra ? { ...sectionData, ...extra } : sectionData
    const Bloque = SECTION_MAP[section.section_type]?.[section.section_variant]
    const directo = Bloque && TIPOS_BLOQUE_FICHA.has(section.section_type) && Object.keys(settings).length === 0
    // Directo (sin SectionWrapper), «Avanzado › Radio de borde, Sombra» (y fondo, borde y color de
    // texto guardados en el contenido) no llegaban a ninguna parte: van en una caja alrededor del
    // bloque. Sin esas claves, ninguna caja: el marcado de hoy.
    const superficie = directo ? buildSurfaceStyle((section.content || {}) as Record<string, unknown>) : null
    const bloqueDirecto = directo ? (
      <Bloque
        key={section.id}
        content={(section.content || {}) as Record<string, any>}
        organization={organization}
        primaryColor={primaryColor}
        data={datosBloque}
        sectionVariant={section.section_variant}
        sectionId={section.id}
      />
    ) : null
    const nodo = directo ? (
      superficie?.className ? (
        <div
          key={section.id}
          data-superficie-ficha=""
          className={`${superficie.className}${superficie.visible ? ' p-4 md:p-6' : ''}`}
          style={superficie.style}
        >
          {bloqueDirecto}
        </div>
      ) : bloqueDirecto
    ) : (
      <SectionRenderer
        key={section.id}
        section={section}
        organization={organization}
        primaryColor={primaryColor}
        data={datosBloque}
        isFirst={section.id === idPrimera}
      />
    )
    const bloque: React.ReactNode = nodo
    // Plantilla sin marcador: la urgencia va justo después de la información.
    const urgenciaTrasInfo = !conMarcador && section.section_type === 'product_info'
      && (section.content as Record<string, unknown> | null)?.show_countdown !== false
    return urgenciaTrasInfo ? [bloque, urgencia(`${section.id}__urgencia`)] : bloque
  }

  /** En las columnas: el bloque de envío con pestaña deja solo su línea corta. */
  const renderEnColumna = (section: WebsitePageSection): React.ReactNode => (
    envioEnPestana && section.id === envioEnPestana.id ? renderSection(section, { envioFicha: 'resumen' }) : renderSection(section)
  )

  // Pestañas de la ficha: cada bloque con pestaña, en su panel (NavAnclas → PestanasFicha).
  const bloqueResenas = planPestanas?.items.find((i) => i.target === 'product_reviews')?.seccion ?? null
  const datosPestanas: DatosPestanasFicha | null = planPestanas && planPestanas.items.length > 0
    ? {
        items: planPestanas.items.map((i) => ({
          id: i.target,
          titulo: i.label,
          contenido: renderSection(i.seccion, { enPestanaFicha: true }),
          conConteoResenas: i.target === 'product_reviews',
        })),
        resenas: bloqueResenas
          ? {
              productId: Number(product.id),
              reviewsConfig: configResenasDeSeccion(bloqueResenas.content as Record<string, unknown> | null, reviewsConfig),
              productStats,
            }
          : null,
      }
    : null
  const bloquePestanas = planPestanas && datosPestanas ? (
    <div className="mt-12 md:mt-16" data-bloque-pestanas-ficha="">
      {renderSection(planPestanas.nav, { pestanasFicha: datosPestanas })}
    </div>
  ) : null

  // Migas con el ← al inicio (Figma 2992:74983, tipo «Ficha»), en escritorio y en el celular (ruta
  // completa en una línea; en el celular, más pegada a la foto: pedido del dueño, 2026-11-24).
  const breadcrumbBlock = showBreadcrumb && (
    <EncabezadoPagina tipo="ficha" enCelular migas={migasVolver} padre={padreVolver} primaryColor={primaryColor} className="-mt-7 mb-5 md:-mt-6 md:mb-8" />
  )

  // Layout según columns
  const layoutGrid = (() => {
    if (columns === '1') {
      return (
        <div className="space-y-12">
          {principales.map(renderEnColumna)}
        </div>
      )
    }

    // columns === '2' o '2+sidebar': la galería y lo anterior a ella, en la columna de la galería.
    const iGaleria = principales.findIndex((s) => s.section_type === 'product_gallery')
    const columnaGaleria = iGaleria >= 0 ? principales.slice(0, iGaleria + 1) : []
    const columnaInfo = iGaleria >= 0 ? principales.slice(iGaleria + 1) : principales
    const galleryStyle = { flexBasis: `${galleryWidth}%` } as React.CSSProperties
    const infoStyle = { flexBasis: `${100 - galleryWidth}%` } as React.CSSProperties
    // Galería en «Desplazamiento»: las fotos bajan con la página y la información queda fija
    // debajo del header, o sube hasta mostrar su final si es más alta que la pantalla
    // (ColumnaInfoFija). Los demás modos, como siempre (top-4).
    const contenidoGaleria = (iGaleria >= 0 ? principales[iGaleria].content : null) as Record<string, unknown> | null
    const galeriaScroll = contenidoGaleria?.gallery_layout === 'scroll'

    return (
      <div className="flex flex-col lg:flex-row gap-12">
        <div style={galleryStyle} className="space-y-3">
          {columnaGaleria.map(renderEnColumna)}
        </div>
        <div style={infoStyle} className="min-w-0">
          {stickyColumn && galeriaScroll ? (
            <ColumnaInfoFija className="space-y-6">{columnaInfo.map(renderEnColumna)}</ColumnaInfoFija>
          ) : (
            <div className={`space-y-6 ${stickyColumn ? 'lg:sticky lg:top-4 lg:self-start' : ''}`}>
              {columnaInfo.map(renderEnColumna)}
            </div>
          )}
        </div>
      </div>
    )
  })()

  const ficha = (
    <div className="container mx-auto px-4 py-12">
      {breadcrumbBlock}
      {layoutGrid}

      {/* Pestañas de la ficha: debajo de las dos columnas, a todo el ancho */}
      {bloquePestanas}

      {/* Productos relacionados y reseñas, a todo el ancho */}
      {anchoCompleto.map((s) => renderSection(s))}
    </div>
  )

  // Etiquetas de la ficha (Información del producto › Etiquetas, Figma 3036:78040). Sin
  // `labels_show: true`, ningún proveedor: la ficha de hoy.
  const bloqueInfo = visibles.find((s) => s.section_type === 'product_info')
  const opcionesEtiquetas = leerOpcionesEtiquetasFicha(bloqueInfo?.content as Record<string, unknown> | null)
  if (!opcionesEtiquetas.mostrar) return ficha
  const bloqueGaleria = visibles.find((s) => s.section_type === 'product_gallery')
  const precioBase = price ? Number(price.price) : 0
  return (
    <ProveedorEtiquetasFicha
      opciones={opcionesEtiquetas}
      producto={{ id: Number(product.id), parent_product_id: product.parent_product_id ?? null, category_id: product.category_id ?? null, brand: product.brand ?? null }}
      datos={{
        discount: comparePrice != null && comparePrice > precioBase && precioBase > 0 ? Math.round((1 - precioBase / comparePrice) * 100) : null,
        outOfStock: isOutOfStock(product),
        isParent: isParentProduct(product),
        padreSinVariantes: padreSinVariantes(product),
        variantCount: Array.isArray(variants) ? variants.length : 0,
        // La ficha no trae ventas (las calcula el listado): «vendidos» queda para la segunda ronda.
        salesCount: Number(product.sales_count) || 0,
        createdAt: product.created_at ?? null,
      }}
      precio={precioBase}
      variantes={(variants ?? []).map((v: { id: number }) => Number(v.id))}
      sinFoto={(bloqueGaleria?.content as Record<string, unknown> | null)?.show_badges === false}
      primaryColor={primaryColor}
    >
      {ficha}
    </ProveedorEtiquetasFicha>
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
