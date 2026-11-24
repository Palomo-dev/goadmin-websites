import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { MenuLateralCuenta, SembrarAvatar, VolverMiCuenta } from '@/components/site/cuenta/MenuMiCuenta'
import { ProveedorMenuCuenta } from '@/components/site/cuenta/PestanasCuenta'
import { cifrasCuenta, getCuentaCliente } from '@/lib/cuenta/cuentaCliente'
import { facturaCompleta, filasMenuCuenta, identidadCuenta, menuCuenta, vendeConPedidos } from '@/lib/cuenta/reglasCuenta'
import { ayudaCuenta } from '@/lib/cuenta/ayudaCuenta'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { urlFaviconDeLaPeticion } from '@/lib/website/faviconDeOrganizacion'
import { hrefIconoFavicon } from '@/lib/website/v2/faviconPublico'
import { colorCabeceraDe } from '@/lib/navegacion/coloresVolver'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) {
    return {
      title: 'Mi Cuenta',
    }
  }

  const { organization } = ctx
  const icono = hrefIconoFavicon(await urlFaviconDeLaPeticion())

  return {
    title: `Mi Cuenta | ${organization.name}`,
    icons: {
      icon: icono ?? '/favicon.ico',
      apple: icono ?? '/apple-touch-icon.png',
    }
  }
}

/**
 * Mi cuenta V2 (Figma «16 Sitio web» 3044:78726, aprobado 2026-11-24): menú lateral con avatar,
 * nombre de la ficha y correo, los accesos agrupados (Compras · Mi información · Ayuda) con sus
 * cifras, según el tipo de negocio (`menuCuenta`/`filasMenuCuenta`). En el celular el menú es la
 * lista de Inicio y las demás páginas llevan el ← a Mi cuenta y las pestañas deslizables
 * (`PestanasCuenta`, que leen el menú de `ProveedorMenuCuenta`). Las cifras (`cifrasCuenta`) van en
 * react.cache: Inicio las reusa sin volver a consultar.
 */
export default async function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  // Proteger ruta: redirigir a /auth si no hay sesión
  const cuenta = await getCuentaCliente(ctx.organization.id)
  if (!cuenta) redirect('/auth?siguiente=/mi-cuenta')

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, effectiveSettings } = ctx
  const tipo = organization.type_id ?? 0
  const navItems = menuCuenta(tipo)
  const c = cuenta.cliente
  const identidad = identidadCuenta(c, cuenta.correo)
  const cifras = await cifrasCuenta(organization.id, cuenta, vendeConPedidos(tipo))
  const grupos = filasMenuCuenta(tipo, cifras, { nombre: identidad.nombre, telefono: c?.phone ?? null, facturaCompleta: facturaCompleta(c) })
  const ayuda = ayudaCuenta(effectiveSettings, footerNav)

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      frozenReason={frozenReason}
    >
      <div className="bg-slate-50 text-slate-900" style={{ ['--primary-color' as string]: primaryColor }}>
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 pb-16 pt-5 md:flex-row md:px-6 md:pt-10">
          <aside className="hidden w-[260px] flex-shrink-0 md:block">
            <div className="sticky top-24">
              <MenuLateralCuenta identidad={identidad} grupos={grupos} ayuda={ayuda} primaryColor={primaryColor} />
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            <SembrarAvatar usuario={cuenta.userId} identidad={identidad} />
            <VolverMiCuenta items={navItems} primaryColor={primaryColor} colorCabecera={colorCabeceraDe(organization.website_settings)} />
            <ProveedorMenuCuenta items={navItems}>{children}</ProveedorMenuCuenta>
          </main>
        </div>
      </div>
    </OrganizationLayout>
  )
}
