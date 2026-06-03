'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Phone, Mail, User, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrganizationWithDetails, WebsitePage } from '@/types/database'
import { type NavItem, type TemplateConfig } from '@/lib/templates'
import { CartIndicator } from './CartIndicator'
import { ProductSearch } from './ProductSearch'

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
  const settings = organization.website_settings as any
  
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
            
            {showHeaderCart && (
              <CartIndicator
                primaryColor={primaryColor}
                cartBehavior={cartBehavior}
                onClick={onCartClick}
              />
            )}
            
            {showHeaderAuth && (
              <Link href="/auth" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <User className="h-6 w-6 text-gray-700 dark:text-gray-300" />
              </Link>
            )}
          </div>
          
          {/* Mobile Actions: Search + Cart + Login + Menu */}
          <div className="flex md:hidden items-center gap-1">
            <ProductSearch primaryColor={primaryColor} organizationId={organization.id} />
            
            {showHeaderCart && (
              <CartIndicator
                primaryColor={primaryColor}
                cartBehavior={cartBehavior}
                onClick={onCartClick}
              />
            )}

            {showHeaderAuth && (
              <Link href="/auth" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <User className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </Link>
            )}
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              ) : (
                <Menu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 dark:border-gray-800">
            <nav className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              {showHeaderAuth && (
                <Link
                  href="/auth"
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-5 w-5" />
                  Iniciar sesión
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
