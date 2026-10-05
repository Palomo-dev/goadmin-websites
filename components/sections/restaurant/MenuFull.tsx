/**
 * Sección `menu_full` — «Carta completa» (Figma MenuFull 136:2340).
 *
 * Sin directiva de cliente a propósito: el manifiesto del sitio
 * (lib/sectionManifest.ts) lee `MenuFull.CONTENT_KEYS` desde un route handler,
 * y en un módulo 'use client' esa lectura no es posible. Este archivo solo
 * normaliza el contenido; agrupar productos y la interacción viven en
 * MenuFullView (cliente), así que nada de aquí llama a código de cliente si
 * algún renderer de servidor llegara a pintar la sección.
 *
 * Datos: `data.products` y `data.categories` los precarga
 * `app/[[...slug]]/page.tsx` con `getOrganizationProducts` /
 * `getOrganizationCategories` — los mismos de `menu_preview`, filtrados por el
 * organization_id del contexto y por la sede de la página. No hay consultas
 * nuevas por render.
 */

import type { OrganizationWithDetails } from '@/types/database'
import { parseSchedules, type MenuSourceCategory, type MenuSourceProduct } from '@/lib/menu/menuFull'
import { MenuFullView, type MenuFullVariant } from './MenuFullView'
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
] as const

const VARIANTS: readonly MenuFullVariant[] = ['anchors', 'tabs', 'per_category']
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

export function MenuFull({ content, organization, data, sectionVariant, sectionId }: MenuFullProps) {
  const variant: MenuFullVariant = VARIANTS.includes(sectionVariant as MenuFullVariant)
    ? (sectionVariant as MenuFullVariant)
    : 'anchors'

  const products = (Array.isArray(data?.products) ? data.products : []) as MenuSourceProduct[]
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
    />
  )
}

MenuFull.CONTENT_KEYS = CONTENT_KEYS
