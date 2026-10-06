/**
 * Sección `menu_full` — «Carta completa» (Figma MenuFull 136:2340), con las
 * variantes anchors, tabs, per_category y editorial.
 *
 * Sin directiva de cliente a propósito: el manifiesto del sitio
 * (lib/sectionManifest.ts) lee `MenuFull.CONTENT_KEYS` desde un route handler,
 * y en un módulo 'use client' esa lectura no es posible. Este archivo solo
 * normaliza el contenido; agrupar productos y la interacción viven en
 * MenuFullView (cliente), así que nada de aquí llama a código de cliente si
 * algún renderer de servidor llegara a pintar la sección.
 *
 * Datos: `data.menuProducts` (carta completa paginada, `getMenuCatalogProducts`;
 * si falta, `data.products`), `data.categories`, `data.productTags` y
 * `data.sedesRestaurante`, precargados por `app/[[...slug]]/page.tsx` y
 * filtrados por el organization_id del contexto y la sede de la página. No hay
 * consultas por render en la sección.
 *
 * También pinta `menu_preview` (SectionRenderer): las páginas /menu que
 * quedaron con esa sección muestran la carta completa y dejan pedir.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { parseSchedules, type MenuSourceCategory, type MenuSourceProduct, type MenuTagSource } from '@/lib/menu/menuFull'
import { leerCartaPlatos } from '@/lib/menu/cartaPlatos'
import { MenuFullView, type MenuFullVariant, type SedeDeCarta } from './MenuFullView'
import { sedeAceptaReservas, type SedesRestaurante } from '@/lib/restaurant/sedes-modelo'
import type { MenuItemSize } from './MenuItemRow'

/** Claves de `content` que lee la sección (contrato editor ↔ sitio, F0.6). */
export const CONTENT_KEYS = [
  'eyebrow',
  'title',
  'subtitle',
  'show_photos',
  'size',
  'columns',
  'show_description',
  'selected_category_ids',
  'pdf_url',
  'menus',
  // Orden, ocultos, destacados y textos propios del constructor de la carta del ERP.
  'carta_platos',
] as const

const VARIANTS: readonly MenuFullVariant[] = ['anchors', 'tabs', 'per_category', 'editorial']
const SIZES: readonly MenuItemSize[] = ['regular', 'compact', 'auto']

interface MenuFullProps {
  content: Record<string, unknown>
  organization: OrganizationWithDetails
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

/** Solo enlaces http(s) o rutas del propio sitio para «Carta en PDF». */
function safeUrl(value: unknown): string | null {
  const url = str(value)
  if (!url) return null
  return /^(https?:\/\/|\/)/i.test(url) ? url : null
}

function esSedes(v: unknown): v is SedesRestaurante {
  return typeof v === 'object' && v !== null && Array.isArray((v as { sedes?: unknown }).sedes)
}

/**
 * Sede de la carta: la de la página o, en el sitio principal, la principal (misma regla que
 * `resolverSedeCarta`). Nombre solo con varias sedes; reservar solo si la sede las acepta.
 */
function sedeDeCarta(datos: unknown, branchId: number | null, reservarUrl: string | null): SedeDeCarta | null {
  if (!esSedes(datos) || datos.sedes.length === 0) return null
  const sede = branchId !== null ? datos.sedes.find((s) => s.id === branchId) : datos.sedes.find((s) => s.esPrincipal) ?? datos.sedes[0]
  if (!sede) return null
  return {
    nombre: datos.sedes.length > 1 ? sede.nombre : null,
    horario: sede.horario,
    zonaHoraria: sede.zonaHoraria,
    reservarHref: reservarUrl && sedeAceptaReservas(sede, datos) ? reservarUrl : null,
  }
}

export function MenuFull({ content, organization, data, sectionVariant, sectionId }: MenuFullProps) {
  const variant: MenuFullVariant = VARIANTS.includes(sectionVariant as MenuFullVariant)
    ? (sectionVariant as MenuFullVariant)
    : 'anchors'

  // Carta completa sin el corte de 500 del listado general; si la página no la cargó, el listado.
  const fuente = Array.isArray(data?.menuProducts) ? data.menuProducts : Array.isArray(data?.products) ? data.products : []
  const products = fuente as MenuSourceProduct[]
  const tags = (Array.isArray(data?.productTags) ? data.productTags : []) as MenuTagSource[]
  const horaSimulada = typeof data?.horaSimulada === 'number' ? data.horaSimulada : null
  const categories = (Array.isArray(data?.categories) ? data.categories : []) as MenuSourceCategory[]
  const selectedIds = Array.isArray(content.selected_category_ids)
    ? content.selected_category_ids.map(Number).filter((n) => Number.isFinite(n))
    : null

  // Diseño: anclas sin foto y a dos columnas; pestañas con foto a dos
  // columnas; por categoría con foto a una columna (pensada para Carta QR).
  const showPhotos = bool(content.show_photos, variant !== 'anchors')
  const columnsRaw = Number(content.columns)
  const columns: 1 | 2 = columnsRaw === 1 || columnsRaw === 2 ? columnsRaw : variant === 'per_category' ? 1 : 2
  const size: MenuItemSize = SIZES.includes(content.size as MenuItemSize) ? (content.size as MenuItemSize) : 'auto'

  const defaultTitle = variant === 'per_category' ? null : 'Nuestra carta'
  const defaultEyebrow = variant === 'anchors' ? 'Carta' : null

  // «Agregar» solo con pedido en línea activo. `website_settings` ya es la
  // configuración efectiva de la sede (getOrgContext la sustituye por outlet).
  const canOrder = organization.website_settings?.enable_online_ordering === true

  const branchId = typeof data?.branchId === 'number' ? data.branchId : null

  return (
    <MenuFullView
      variant={variant}
      products={products}
      categories={categories}
      selectedCategoryIds={selectedIds}
      cartaPlatos={leerCartaPlatos(content)}
      schedules={parseSchedules(content.menus)}
      eyebrow={'eyebrow' in content ? str(content.eyebrow) : defaultEyebrow}
      title={'title' in content ? str(content.title) : defaultTitle}
      subtitle={str(content.subtitle)}
      pdfUrl={safeUrl(content.pdf_url)}
      layout={showPhotos ? 'photo' : 'list'}
      size={size}
      columns={columns}
      showDescription={bool(content.show_description, true)}
      canOrder={canOrder}
      timeZone={organization.timezone || 'America/Bogota'}
      organizationSubdomain={organization.subdomain || ''}
      branchId={branchId}
      sectionKey={(sectionId || 'menu').slice(0, 8)}
      tags={tags}
      sede={sedeDeCarta(data?.sedesRestaurante, branchId, typeof data?.reservarUrl === 'string' ? data.reservarUrl : null)}
      horaSimulada={horaSimulada}
    />
  )
}

MenuFull.CONTENT_KEYS = CONTENT_KEYS
