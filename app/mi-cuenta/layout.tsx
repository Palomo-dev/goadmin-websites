import { getOrgContext } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import Link from 'next/link'

// Navegación lateral según tipo de negocio
function getAccountNav(typeId: number) {
  const shared = [
    { href: '/mi-cuenta', label: 'Dashboard', icon: '🏠' },
    { href: '/mi-cuenta/perfil', label: 'Mi Perfil', icon: '👤' },
  ]

  const byType: Record<number, Array<{ href: string; label: string; icon: string }>> = {
    // restaurant (1)
    1: [
      { href: '/mi-cuenta/pedidos', label: 'Mis Pedidos', icon: '📦' },
      { href: '/mi-cuenta/reservas', label: 'Mis Reservas', icon: '📅' },
      { href: '/mi-cuenta/direcciones', label: 'Direcciones', icon: '📍' },
      { href: '/mi-cuenta/cupones', label: 'Cupones', icon: '🎟️' },
    ],
    // hotel (2)
    2: [
      { href: '/mi-cuenta/reservas', label: 'Mis Reservas', icon: '📅' },
    ],
    // retail (3)
    3: [
      { href: '/mi-cuenta/pedidos', label: 'Mis Pedidos', icon: '📦' },
      { href: '/mi-cuenta/direcciones', label: 'Direcciones', icon: '📍' },
      { href: '/mi-cuenta/cupones', label: 'Cupones', icon: '🎟️' },
    ],
    // services (4)
    4: [
      { href: '/mi-cuenta/citas', label: 'Mis Citas', icon: '📅' },
      { href: '/mi-cuenta/facturas', label: 'Facturas', icon: '📄' },
      { href: '/mi-cuenta/cotizaciones', label: 'Cotizaciones', icon: '📋' },
    ],
    // gym (5)
    5: [
      { href: '/mi-cuenta/membresia', label: 'Membresía', icon: '💪' },
      { href: '/mi-cuenta/clases', label: 'Mis Clases', icon: '📅' },
      { href: '/mi-cuenta/checkins', label: 'Check-ins', icon: '✅' },
    ],
    // transport (6)
    6: [
      { href: '/mi-cuenta/tickets', label: 'Mis Tickets', icon: '🎫' },
    ],
    // parking (7)
    7: [
      { href: '/mi-cuenta/pases', label: 'Mis Pases', icon: '🎫' },
      { href: '/mi-cuenta/vehiculos', label: 'Vehículos', icon: '🚗' },
      { href: '/mi-cuenta/historial', label: 'Historial', icon: '📋' },
    ],
  }

  return [...shared, ...(byType[typeId] || [])]
}

export default async function MiCuentaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, template, headerNav, footerNav } = ctx
  const navItems = getAccountNav(organization.type_id ?? 0)

  return (
    <OrganizationLayout
      organization={organization}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4 space-y-1 sticky top-24">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
              <hr className="my-2 dark:border-gray-700" />
              <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm w-full text-left">
                <span>🚪</span>
                <span>Cerrar Sesión</span>
              </button>
            </nav>
          </aside>

          {/* Contenido principal */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </OrganizationLayout>
  )
}
