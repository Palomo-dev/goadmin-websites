import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { MenuLateralCuenta, VolverMiCuenta } from '@/components/site/cuenta/MenuMiCuenta'
import { getCuentaCliente } from '@/lib/cuenta/cuentaCliente'
import { iniciales, menuCuenta } from '@/lib/cuenta/reglasCuenta'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { urlFaviconDeLaPeticion } from '@/lib/website/faviconDeOrganizacion'
import { hrefIconoFavicon } from '@/lib/website/v2/faviconPublico'

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
 * Mi cuenta (Figma «16 Sitio web» D 2976:72025 y H 2977:72694, aprobados 2026-11-24): menú lateral
 * con iniciales, nombre y correo (sin emojis), según el tipo de negocio (`menuCuenta`). En el
 * celular el menú es la lista de Inicio y las demás páginas llevan «‹ Mi cuenta».
 */
export default async function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  // Proteger ruta: redirigir a /auth si no hay sesión
  const cuenta = await getCuentaCliente(ctx.organization.id)
  if (!cuenta) redirect('/auth?siguiente=/mi-cuenta')

  const { organization, primaryColor, template, headerNav, footerNav, frozenReason } = ctx
  const navItems = menuCuenta(organization.type_id ?? 0)
  const c = cuenta.cliente
  const nombre = [c?.first_name, c?.last_name].map((x) => (x || '').trim()).filter(Boolean).join(' ') || null

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
              <MenuLateralCuenta items={navItems} nombre={nombre} correo={cuenta.correo} iniciales={iniciales(nombre, cuenta.correo)} />
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            <VolverMiCuenta />
            {children}
          </main>
        </div>
      </div>
    </OrganizationLayout>
  )
}
