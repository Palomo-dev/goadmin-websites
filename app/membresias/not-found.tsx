import { ShoppingBag } from 'lucide-react'
import Link from '@/components/site/Enlace'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { getOrgContext } from '@/lib/get-org-context'
import { getDefaultTax, getGoogleAdsConfig, getMetaPixelId } from '@/lib/supabase/queries'
import { conPrefijo } from '@/lib/outlet/rutaSitio'
import { SLUG_PAGINA_MEMBRESIAS } from '@/lib/website/v2/contrato/paginaMembresias'

/**
 * /membresias sin planes de membresía activos (Figma «16 Sitio web» D, 3284-101231): respuesta 404
 * (Next pone `noindex`) con la MARCA DE LA TIENDA —su cabecera, su pie y su color—, nunca la de GO
 * Admin. El visitante sigue en la tienda: Inicio, productos y sus categorías. Si la tienda crea su
 * primer plan, la página vuelve sola.
 */
export default async function MembresiasNoDisponible() {
  const ctx = await getOrgContext(SLUG_PAGINA_MEMBRESIAS)
  if (!ctx) return <NotFoundPage />
  const { organization, outlet, branchId, effectiveSettings: settings, primaryColor, template, headerNav, headerNavTree, footerNav, footerNavTree, menuCategories, megaMenuItems, websiteMenus, frozenReason, showCurrencyCode, currencyPosition, categoriasTienda } = ctx
  const prefijo = ctx.prefijoSede ?? ''
  const [metaPixelId, googleAdsConfig, taxSettings] = await Promise.all([
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id),
    getDefaultTax(organization.id),
  ])
  // Categorías raíz de la tienda (ya cargadas por getOrgContext: sin consultas nuevas).
  const categorias = (categoriasTienda ?? [])
    .filter((c) => !c.parent_id && c.slug)
    .slice(0, 5)

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} headerNavTree={headerNavTree} menuCategories={menuCategories} megaMenuItems={megaMenuItems ?? undefined} footerNav={footerNav} footerNavTree={footerNavTree} menus={websiteMenus ?? []} metaPixelId={metaPixelId} googleAdsConfig={googleAdsConfig} taxSettings={taxSettings} frozenReason={frozenReason} effectiveSettings={settings} outlet={outlet} branchId={branchId} showCurrencyCode={showCurrencyCode} currencyPosition={currencyPosition}>
      <section data-membresias-no-disponible="" className="flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <span
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 14%, transparent)`, color: primaryColor }}
          >
            <ShoppingBag aria-hidden="true" className="h-7 w-7" />
          </span>
          <h1 className="mb-3 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">Esta página no está disponible</h1>
          <p className="mb-8 text-gray-600 dark:text-gray-300">Por ahora esta tienda no ofrece membresías. Sigue explorando lo que sí tenemos.</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href={conPrefijo('/', prefijo)}
              className="rounded-lg px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Ir al inicio
            </Link>
            <Link
              href={conPrefijo('/productos', prefijo)}
              className="rounded-lg border-2 px-6 py-3 font-semibold transition-opacity hover:opacity-90"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              Ver productos
            </Link>
          </div>
          {categorias.length > 0 && (
            <ul className="mt-6 flex flex-wrap justify-center gap-2">
              {categorias.map((c) => (
                <li key={c.id}>
                  <Link
                    href={conPrefijo(`/categorias/${c.slug}`, prefijo)}
                    className="inline-block rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </OrganizationLayout>
  )
}
