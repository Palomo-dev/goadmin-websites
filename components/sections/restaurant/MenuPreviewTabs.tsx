/**
 * Sección `menu_preview` (variante `tabs`).
 *
 * - En la página de la carta (`/menu`) es la carta completa: delega en `MenuFull` con pestañas,
 *   que ya trae «Agregar» condicionado al pedido en línea, hoja del plato, agotado, etiquetas y
 *   mesa del QR. Antes enseñaba como máximo 4 categorías y no dejaba pedir (8 sitios en vivo).
 * - En cualquier otra página (la home) es un avance: primero las categorías que tienen platos,
 *   después el límite (`content.max_categories`, 4 por defecto) y `max_items` por categoría,
 *   con el precio en la moneda del sitio y el agotado marcado. Con cartas por horario del ERP
 *   (`data.cartasPublicas`) el avance respeta la carta vigente (o la primera): sus categorías en
 *   su orden, sin los platos que oculta y con los destacados primero. Sin ellas, como siempre.
 *
 * Sin directiva de cliente (como MenuFull). No declara CONTENT_KEYS para no cambiar el contrato
 * editor ↔ sitio: `max_categories` es opcional y el editor aún no lo ofrece.
 */

import Link from 'next/link'
import type { OrganizationWithDetails } from '@/types/database'
import { Price } from '@/components/site/CurrencyProvider'
import { buildMenuGroups, type MenuSourceCategory, type MenuSourceProduct } from '@/lib/menu/menuFull'
import { aplicarCartaPlatos } from '@/lib/menu/cartaPlatos'
import { cartasParaSeccion, categoriasDeCarta, platosDeCarta } from '@/lib/menu/cartasPublicas'
import { MenuFull } from './MenuFull'
import { conPrefijo } from '@/lib/outlet/rutaSitio'

interface MenuPreviewTabsProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
    max_categories?: number
    cta_text?: string
    cta_url?: string
  }
  organization: OrganizationWithDetails
  primaryColor?: string
  data?: Record<string, unknown>
  sectionVariant?: string
  sectionId?: string
}

function entero(valor: unknown, porDefecto: number): number {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : porDefecto
}

/** Solo rutas del sitio o http(s) para el botón. */
function enlaceSeguro(valor: unknown): string | null {
  return typeof valor === 'string' && /^(https?:\/\/|\/|#)/i.test(valor.trim()) ? valor.trim() : null
}

export function MenuPreviewTabs({ content, organization, primaryColor, data, sectionId }: MenuPreviewTabsProps) {
  if (data?.pageSlug === 'menu') {
    return (
      <MenuFull
        content={content as Record<string, unknown>}
        organization={organization}
        data={data}
        sectionVariant="tabs"
        sectionId={sectionId}
      />
    )
  }

  const products = (Array.isArray(data?.products) ? data.products : []) as MenuSourceProduct[]
  const categories = (Array.isArray(data?.categories) ? data.categories : []) as MenuSourceCategory[]
  const maxItems = entero(content.max_items, 6)
  const maxCategories = entero(content.max_categories, 4)
  // buildMenuGroups ya descarta categorías sin platos con precio: el límite va después.
  // Misma elección de carta que /menu (cartasParaSeccion): la vigente o la primera con categorías.
  const carta = cartasParaSeccion(data?.cartasPublicas, null)?.elegida ?? null
  const grupos = (carta
    ? aplicarCartaPlatos(
        buildMenuGroups(products, categories, categoriasDeCarta(carta)),
        platosDeCarta(carta, products.map((p) => ({ id: p.id, category_id: p.category_id ?? null }))),
        categoriasDeCarta(carta),
      )
    : buildMenuGroups(products, categories)
  ).slice(0, maxCategories)
  const cta = enlaceSeguro(content.cta_url)
  // Sede servida por prefijo de ruta (`data.prefijoSede`, lo pone page.tsx): enlaces de la sede.
  const prefijo = typeof data?.prefijoSede === 'string' ? data.prefijoSede : ''

  return (
    <div>
      {content.title && (
        <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">{content.title}</h2>
      )}
      {content.subtitle && <p className="mb-8 text-center text-gray-600 dark:text-gray-300">{content.subtitle}</p>}

      {grupos.length > 0 ? (
        <div className="space-y-10">
          {grupos.map((g) => (
            <div key={g.id}>
              <h3
                className="mb-4 border-b pb-2 text-xl font-semibold text-gray-900 dark:border-gray-600 dark:text-white"
                style={{ borderColor: primaryColor }}
              >
                {g.name}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {g.items.slice(0, maxItems).map((item) => (
                  <Link
                    key={item.id}
                    href={conPrefijo(`/productos/${item.uuid}`, prefijo)}
                    className={`flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${item.soldOut ? 'opacity-60' : ''}`}
                  >
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura de 64 px, como antes
                      <img src={item.imageUrl} alt={item.name} className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" loading="lazy" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-medium text-gray-900 dark:text-white">{item.name}</h4>
                      {item.description && (
                        <p className="line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                      )}
                      {item.soldOut && (
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Agotado</span>
                      )}
                    </div>
                    {item.price !== null && (
                      <Price value={item.price} className="whitespace-nowrap font-bold" style={{ color: primaryColor }} />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed py-12 text-center text-gray-400 dark:border-gray-700">
          <p>Menú no disponible aún</p>
        </div>
      )}

      {content.cta_text && cta && (
        <div className="mt-8 text-center">
          <Link href={conPrefijo(cta, prefijo)} className="inline-block rounded-lg px-6 py-3 font-medium text-white" style={{ backgroundColor: primaryColor }}>
            {content.cta_text}
          </Link>
        </div>
      )}
    </div>
  )
}
