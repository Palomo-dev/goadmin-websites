'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrganizationWithDetails } from '@/types/database'

interface SiteHeaderProps {
  organization: OrganizationWithDetails
  primaryColor: string
}

export function SiteHeader({ organization, primaryColor }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const navItems = [
    { name: 'Inicio', href: '/' },
    { name: 'Productos', href: '#productos' },
    { name: 'Servicios', href: '#servicios' },
    { name: 'Nosotros', href: '#nosotros' },
    { name: 'Contacto', href: '#contacto' },
  ]
  
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
          
          {/* CTA Button */}
          <div className="hidden md:block">
            <Button 
              style={{ backgroundColor: primaryColor }}
              className="hover:opacity-90"
            >
              Contáctanos
            </Button>
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
              <Button 
                style={{ backgroundColor: primaryColor }}
                className="hover:opacity-90 w-full"
              >
                Contáctanos
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
