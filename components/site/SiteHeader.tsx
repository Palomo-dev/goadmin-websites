'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Phone, Mail, User, LogOut, UserCircle, Search, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrganizationWithDetails, WebsitePage } from '@/types/database'
import { type NavItem, type TemplateConfig } from '@/lib/templates'
import { CartIndicator } from './CartIndicator'
import { ProductSearch } from './ProductSearch'
import { CurrencySelector } from './CurrencySelector'
import { createClient } from '@/lib/supabase/client'

interface SiteHeaderProps {
  organization: OrganizationWithDetails
  primaryColor: string
  template?: TemplateConfig
  onCartClick?: () => void
  showCart?: boolean
  headerNav?: WebsitePage[]
}

// Navegación por defecto si no hay template
const defaultNavItems: NavItem[] = [
  { name: 'Inicio', href: '/' },
  { name: 'Productos', href: '/productos' },
  { name: 'Servicios', href: '/servicios' },
  { name: 'Nosotros', href: '/nosotros' },
  { name: 'Contacto', href: '/contacto' },
]

export function SiteHeader({ organization, primaryColor, template, onCartClick, showCart = true, headerNav }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const settings = organization.website_settings as any

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])
  
  // Prioridad: headerNav (website_pages) > template.navigation > defaultNavItems
  const navItems: NavItem[] = headerNav && headerNav.length > 0
    ? headerNav.map(p => ({ name: p.title, href: p.slug === 'home' ? '/' : `/${p.slug}` }))
    : template?.navigation || defaultNavItems
  
  
  // Flags de visibilidad desde website_settings
  const showTopbar = settings?.show_topbar !== false
  const showHeaderCart = settings?.show_header_cart !== false && showCart
  const showHeaderAuth = settings?.show_header_auth !== false
  const cartBehavior: 'drawer' | 'redirect' = settings?.cart_click_behavior === 'redirect' ? 'redirect' : 'drawer'
  const logoHeight = settings?.logo_height || 48
  
  return (
    <>
    <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md sticky top-0 z-50 shadow-sm dark:shadow-gray-800/30">
      <div className="container mx-auto px-4">
        {/* Top bar con información de contacto */}
        {showTopbar && (organization.phone || organization.email) && (
          <div className="hidden md:flex justify-end items-center py-2 text-sm border-b border-gray-100 dark:border-gray-800">
            {organization.phone && (
              <a href={`tel:${organization.phone}`} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mr-4">
                <Phone className="h-3 w-3 mr-1" />
                {organization.phone}
              </a>
            )}
            {organization.email && (
              <a href={`mailto:${organization.email}`} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Mail className="h-3 w-3 mr-1" />
                {organization.email}
              </a>
            )}
          </div>
        )}
        
        {/* Main navigation */}
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            {organization.logo_url ? (
              <Image
                src={organization.logo_url}
                alt={organization.name}
                width={logoHeight * 3}
                height={logoHeight}
                className="w-auto object-contain"
                style={{ height: `${logoHeight}px` }}
              />
            ) : (
              <>
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  {organization.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {organization.name}
                </span>
              </>
            )}
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
              >
                {item.name}
              </a>
            ))}
          </nav>
          
          {/* Actions: Search, Cart, Login */}
          <div className="hidden md:flex items-center space-x-4">
            <ProductSearch primaryColor={primaryColor} organizationId={organization.id} />

            <CurrencySelector primaryColor={primaryColor} />
            
            {showHeaderCart && (
              <CartIndicator
                primaryColor={primaryColor}
                cartBehavior={cartBehavior}
                onClick={onCartClick}
                organizationSubdomain={organization.subdomain || ''}
              />
            )}
            
            {showHeaderAuth && (
              isLoggedIn ? (
                <Link href="/mi-cuenta" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Mi Cuenta">
                  <UserCircle className="h-6 w-6" style={{ color: primaryColor }} />
                </Link>
              ) : (
                <Link href="/auth" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <User className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                </Link>
              )
            )}
          </div>
          
          {/* Mobile Actions: Search + Cart + Menu */}
          <div className="flex md:hidden items-center gap-1">
            <ProductSearch primaryColor={primaryColor} organizationId={organization.id} />
            
            {showHeaderCart && (
              <CartIndicator
                primaryColor={primaryColor}
                cartBehavior={cartBehavior}
                onClick={onCartClick}
                organizationSubdomain={organization.subdomain || ''}
              />
            )}
            
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
        
      </div>
    </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <span className="font-bold text-gray-900 dark:text-white">Menú</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}

              {isLoggedIn && showHeaderAuth && (
                <Link
                  href="/mi-cuenta"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <UserCircle className="h-5 w-5" style={{ color: primaryColor }} />
                  Mi Cuenta
                </Link>
              )}
            </nav>

            {/* Currency selector */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-500 dark:text-gray-400">
                <Globe className="h-4 w-4" />
                <span>Moneda</span>
              </div>
              <CurrencySelector primaryColor={primaryColor} />
            </div>

            {/* Auth buttons */}
            {showHeaderAuth && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                {isLoggedIn ? (
                  <button
                    onClick={async () => {
                      const supabase = createClient()
                      await supabase.auth.signOut()
                      setMobileMenuOpen(false)
                      window.location.href = '/'
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                ) : (
                  <>
                    <Link
                      href="/auth"
                      className="block w-full text-center px-4 py-2.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      href="/auth?tab=register"
                      className="block w-full text-center px-4 py-2.5 rounded-lg font-medium border transition-colors"
                      style={{ 
                        borderColor: primaryColor, 
                        color: primaryColor 
                      }}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Registrarse
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
