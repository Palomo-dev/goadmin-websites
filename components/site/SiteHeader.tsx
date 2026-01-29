'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Phone, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrganizationWithDetails } from '@/types/database'
import { type NavItem, type TemplateConfig } from '@/lib/templates'
import { CartIndicator } from './CartIndicator'

interface SiteHeaderProps {
  organization: OrganizationWithDetails
  primaryColor: string
  template?: TemplateConfig
  onCartClick?: () => void
  showCart?: boolean
}

// Navegación por defecto si no hay template
const defaultNavItems: NavItem[] = [
  { name: 'Inicio', href: '/' },
  { name: 'Productos', href: '/productos' },
  { name: 'Servicios', href: '/servicios' },
  { name: 'Nosotros', href: '/nosotros' },
  { name: 'Contacto', href: '/contacto' },
]

export function SiteHeader({ organization, primaryColor, template, onCartClick, showCart = true }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Usar navegación del template o la navegación por defecto
  const navItems: NavItem[] = template?.navigation || defaultNavItems
  
  // Obtener el CTA del hero del template
  const ctaText = template?.hero?.ctaText || 'Contáctanos'
  const ctaHref = template?.navigation?.find(n => 
    n.href.includes('reserva') || n.href.includes('contacto')
  )?.href || '/contacto'
  
  return (
    <header className="bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        {/* Top bar con información de contacto */}
        {(organization.phone || organization.email) && (
          <div className="hidden md:flex justify-end items-center py-2 text-sm border-b border-gray-100">
            {organization.phone && (
              <a href={`tel:${organization.phone}`} className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
                <Phone className="h-3 w-3 mr-1" />
                {organization.phone}
              </a>
            )}
            {organization.email && (
              <a href={`mailto:${organization.email}`} className="flex items-center text-gray-600 hover:text-gray-900">
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
                width={48}
                height={48}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {organization.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-xl font-bold text-gray-900">
              {organization.name}
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                {item.name}
              </a>
            ))}
          </nav>
          
          {/* Actions: Cart, Login, CTA */}
          <div className="hidden md:flex items-center space-x-4">
            {showCart && (
              <div onClick={onCartClick} className="cursor-pointer">
                <CartIndicator primaryColor={primaryColor} />
              </div>
            )}
            
            <Link href="/auth" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <User className="h-6 w-6 text-gray-700" />
            </Link>
            
            <Link href={ctaHref}>
              <Button 
                style={{ backgroundColor: primaryColor }}
                className="hover:opacity-90"
              >
                {ctaText}
              </Button>
            </Link>
          </div>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-600" />
            ) : (
              <Menu className="h-6 w-6 text-gray-600" />
            )}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <nav className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-600 hover:text-gray-900 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <Link href={ctaHref} className="w-full">
                <Button 
                  style={{ backgroundColor: primaryColor }}
                  className="hover:opacity-90 w-full"
                >
                  {ctaText}
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
