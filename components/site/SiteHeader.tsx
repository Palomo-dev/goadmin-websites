'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Phone, Mail, User, LogOut, UserCircle, Search, Globe, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrganizationWithDetails, WebsitePage, WebsitePageWithChildren } from '@/types/database'
import { type NavItem, type TemplateConfig } from '@/lib/templates'
import { CartIndicator } from './CartIndicator'
import { ProductSearch } from './ProductSearch'
import { CurrencySelector } from './CurrencySelector'
import { useCurrency } from './CurrencyProvider'
import { createClient } from '@/lib/supabase/client'

// Nuevas variantes de header (Fase 6)
import { useMobileHeader } from './header/useMobileHeader'
import HeaderClassic from './header/HeaderClassic'
import HeaderCentered from './header/HeaderCentered'
import HeaderSplit from './header/HeaderSplit'
import HeaderMinimal from './header/HeaderMinimal'
import HeaderMega from './header/HeaderMega'
import MobileDrawer from './header/mobile/MobileDrawer'
import MobileBottomSheet from './header/mobile/MobileBottomSheet'
import MobileFullscreen from './header/mobile/MobileFullscreen'
import MobileTabs from './header/mobile/MobileTabs'
import type { MenuCategory } from './header/HeaderShared'

interface SiteHeaderProps {
  organization: OrganizationWithDetails
  primaryColor: string
  template?: TemplateConfig
  onCartClick?: () => void
  showCart?: boolean
  headerNav?: WebsitePage[]
  // Nuevas props Fase 5/6
  headerNavTree?: WebsitePageWithChildren[]
  menuCategories?: MenuCategory[]
  megaMenuItems?: NavItem[]
  branchId?: number | null
}

// Navegación por defecto si no hay template
const defaultNavItems: NavItem[] = [
  { name: 'Inicio', href: '/' },
  { name: 'Productos', href: '/productos' },
  { name: 'Servicios', href: '/servicios' },
  { name: 'Nosotros', href: '/nosotros' },
  { name: 'Contacto', href: '/contacto' },
]

// Selector de moneda móvil con chips (restaurado del header original)
function MobileCurrencyChips({ primaryColor }: { primaryColor?: string }) {
  const { currency, availableCurrencies, setCurrency, loading } = useCurrency()
  const [open, setOpen] = useState(false)

  if (loading || availableCurrencies.length <= 1) return null

  const current = availableCurrencies.find(c => c.code === currency)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-400" />
          {current ? `${current.code} — ${current.country}` : currency}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-gray-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Seleccionar moneda</h3>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {availableCurrencies.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCurrency(c.code); setOpen(false) }}
                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    c.code === currency
                      ? 'font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  style={c.code === currency && primaryColor ? { color: primaryColor, backgroundColor: `${primaryColor}10` } : undefined}
                >
                  <span>{c.code}</span>
                  <span className="text-xs text-gray-400">{c.country}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Componente interno para el header móvil legacy (cuando no hay variantes nuevas)
function LegacyMobileMenu({
  organization,
  primaryColor,
  navItems,
  showCart,
  onCartClick,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  organization: OrganizationWithDetails
  primaryColor: string
  navItems: NavItem[]
  showCart?: boolean
  onCartClick?: () => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}) {
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ email: data.user.email || '' })
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email || '' } : null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setMobileMenuOpen(false)
  }

  if (!mobileMenuOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setMobileMenuOpen(false)}
      />
      <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <span className="font-bold text-gray-900 dark:text-white">Menú</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className="block py-2 px-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <MobileCurrencyChips primaryColor={primaryColor} />
          {user ? (
            <>
              <Link
                href="/mi-cuenta"
                className="flex items-center gap-2 py-2 text-gray-700 dark:text-gray-300"
                onClick={() => setMobileMenuOpen(false)}
              >
                <UserCircle className="h-5 w-5" />
                Mi Cuenta
              </Link>
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">Iniciar sesión</Button>
              </Link>
              <Link href="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Registrarse</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componente interno para el header desktop legacy
function LegacyDesktopHeader({
  organization,
  primaryColor,
  template,
  settings,
  navItems,
  showCart,
  onCartClick,
  setMobileMenuOpen,
  branchId,
}: {
  organization: OrganizationWithDetails
  primaryColor: string
  template?: TemplateConfig
  settings: OrganizationWithDetails['website_settings']
  navItems: NavItem[]
  showCart?: boolean
  onCartClick?: () => void
  setMobileMenuOpen: (open: boolean) => void
  branchId?: number | null
}) {
  const logoHeight = settings?.logo_height || 48
  const showHeaderCart = settings?.show_header_cart ?? false
  const showHeaderAuth = settings?.show_header_auth ?? false
  const showTopbar = settings?.show_topbar ?? false

  return (
    <>
      {showTopbar && organization.phone && (
        <div className="hidden md:block bg-gray-900 dark:bg-black text-white text-xs py-1.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {organization.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {organization.phone}
                </span>
              )}
              {organization.email && (
                <span className="hidden lg:flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {organization.email}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0 flex items-center gap-2">
              {organization.logo_url ? (
                <Image
                  src={organization.logo_url}
                  alt={organization.name}
                  width={logoHeight * 2}
                  height={logoHeight}
                  className="h-auto w-auto"
                  style={{ maxHeight: logoHeight }}
                  priority
                />
              ) : (
                <>
                  <div
                    className="rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: primaryColor, width: 32, height: 32 }}
                  >
                    {organization.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white text-lg hidden sm:block">
                    {organization.name}
                  </span>
                </>
              )}
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-5 flex-1 justify-center">
              {navItems.map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors whitespace-nowrap"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <ProductSearch primaryColor={primaryColor} />
              <CurrencySelector />
              {(showCart ?? showHeaderCart) && (
                <CartIndicator onClick={onCartClick} primaryColor={primaryColor} organizationSubdomain={organization.subdomain || ''} branchId={branchId} />
              )}
              {showHeaderAuth && (
                <Link
                  href="/auth"
                  className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                  aria-label="Iniciar sesión"
                >
                  <User className="h-5 w-5" />
                </Link>
              )}
            </div>

            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <ProductSearch primaryColor={primaryColor} />
              {(showCart ?? showHeaderCart) && (
                <CartIndicator onClick={onCartClick} primaryColor={primaryColor} organizationSubdomain={organization.subdomain || ''} branchId={branchId} />
              )}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                aria-label="Abrir menú"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}

export default function SiteHeader({
  organization,
  primaryColor,
  template,
  onCartClick,
  showCart,
  headerNav,
  headerNavTree,
  menuCategories,
  megaMenuItems,
  branchId,
}: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const settings = organization.website_settings

  // Construir nav items
  const navItems: NavItem[] = headerNav && headerNav.length > 0
    ? headerNav.map(p => ({ name: p.title, href: p.slug === 'home' ? '/' : `/${p.slug}` }))
    : template?.navigation || defaultNavItems

  // Si no hay headerNavTree, construir uno plano desde headerNav
  const navTree: WebsitePageWithChildren[] = headerNavTree && headerNavTree.length > 0
    ? headerNavTree
    : (headerNav || []).map(p => ({ ...p, children: [], level: 0 }))

  // Determinar variante de header
  const headerStyle = settings?.header_style || 'default'
  const mobileMenuStyle = settings?.mobile_menu_style || 'drawer'
  // Default 1024 (lg): en 768-1023px el menú desktop no cabe cómodamente,
  // así que se usa el menú móvil hasta llegar a lg.
  const mobileBreakpoint = settings?.mobile_breakpoint || 1024
  const isMobile = useMobileHeader(mobileBreakpoint)

  // Props comunes para todas las variantes
  const variantProps = {
    organization,
    primaryColor,
    navTree,
    settings,
    showCart,
    onCartClick,
    menuCategories,
    megaMenuItems,
    branchId,
  }

  // Siempre usar el sistema de variantes nuevo (unifica el look en todas las páginas)
  if (isMobile) {
    // Renderizar variante móvil según mobile_menu_style
    switch (mobileMenuStyle) {
      case 'bottom_sheet':
        return <MobileBottomSheet {...variantProps} />
      case 'fullscreen':
        return <MobileFullscreen {...variantProps} />
      case 'tabs':
        return <MobileTabs {...variantProps} />
      default:
        return <MobileDrawer {...variantProps} />
    }
  }

  // Renderizar variante desktop según header_style
  switch (headerStyle) {
    case 'centered':
      return <HeaderCentered {...variantProps} />
    case 'split':
      return <HeaderSplit {...variantProps} />
    case 'minimal':
      return <HeaderMinimal {...variantProps} />
    case 'mega':
      return <HeaderMega {...variantProps} />
    default:
      return <HeaderClassic {...variantProps} />
  }
}
