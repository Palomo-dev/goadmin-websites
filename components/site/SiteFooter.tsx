'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Facebook, Twitter, Instagram, Linkedin, Youtube, MapPin, Phone, Mail, Clock, ChevronDown } from 'lucide-react'
import type { OrganizationWithDetails, WebsiteSettings, WebsitePage, WebsitePageWithChildren, Json } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'
import type { MenuCategory } from './header/HeaderShared'

interface SiteFooterProps {
  organization: OrganizationWithDetails
  settings: WebsiteSettings | null
  primaryColor: string
  template?: TemplateConfig
  footerNav?: WebsitePage[]
  footerNavTree?: WebsitePageWithChildren[]
  menuCategories?: MenuCategory[]
}

interface SocialLinks {
  facebook?: string
  twitter?: string
  instagram?: string
  linkedin?: string
  youtube?: string
  tiktok?: string
  whatsapp?: string
}

interface BusinessHours {
  [key: string]: { open: string; close: string; closed?: boolean }
}

interface FooterNavItem {
  name: string
  href: string
  icon?: string | null
  badge?: string | null
  children?: FooterNavItem[]
}

// Convierte un árbol de WebsitePageWithChildren a FooterNavItem[]
function buildFooterNavItems(tree: WebsitePageWithChildren[]): FooterNavItem[] {
  return tree.map((page) => ({
    name: page.title,
    href: page.slug === 'home' ? '/' : `/${page.slug}`,
    icon: page.menu_icon,
    badge: page.menu_badge,
    children: page.children.length > 0 ? buildFooterNavItems(page.children) : undefined,
  }))
}

// Convierte categorías a items de footer
function buildCategoryItems(categories: MenuCategory[]): FooterNavItem[] {
  return categories.map((cat) => ({
    name: cat.name,
    href: `/categorias/${cat.slug}`,
    icon: cat.icon,
    children: cat.children.length > 0 ? buildCategoryItems(cat.children) : undefined,
  }))
}

// Sección colapsable en móvil con <details>
function FooterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      {/* Desktop: título fijo */}
      <h3 className="hidden md:block text-lg font-semibold mb-6 text-white">{title}</h3>
      {/* Móvil: accordion colapsable */}
      <details className="md:hidden group border-b border-gray-800">
        <summary className="flex items-center justify-between cursor-pointer py-4 text-lg font-semibold text-white list-none">
          <span>{title}</span>
          <ChevronDown className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="pb-4">{children}</div>
      </details>
      {/* Desktop: contenido siempre visible */}
      <div className="hidden md:block">{children}</div>
    </div>
  )
}

// Renderiza un link de footer con sub-links indentados
function FooterLinkItem({ item }: { item: FooterNavItem }) {
  const hasChildren = item.children && item.children.length > 0

  return (
    <li>
      <Link
        href={item.href}
        className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
      >
        {item.icon && <span className="text-base">{item.icon}</span>}
        <span>{item.name}</span>
        {item.badge && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
            style={{ backgroundColor: 'currentColor' }}
          >
            {item.badge}
          </span>
        )}
      </Link>
      {/* Sub-links indentados */}
      {hasChildren && (
        <ul className="ml-3 mt-2 space-y-2 border-l border-gray-800 pl-3">
          {item.children!.map((child, j) => (
            <li key={j}>
              <Link
                href={child.href}
                className="text-gray-500 hover:text-white transition-colors text-xs"
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function SiteFooter({
  organization,
  settings,
  primaryColor,
  template,
  footerNav,
  footerNavTree,
  menuCategories,
}: SiteFooterProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const socialLinks = (settings?.social_links || {}) as SocialLinks
  const businessHours = (settings?.business_hours || {}) as BusinessHours
  const footerText = settings?.footer_text || `© ${new Date().getFullYear()} ${organization.name}. Todos los derechos reservados.`
  const showPoweredBy = settings?.show_powered_by !== false
  const logoHeight = settings?.logo_height || 48
  const footerStyle = settings?.footer_style || 'default'
  const showCategoriesInFooter =
    !!menuCategories &&
    menuCategories.length > 0 &&
    settings?.show_categories_in_header === true // reutilizamos el flag; en futuro puede haber show_categories_in_footer

  // Construir nav items jerárquicos desde footerNavTree (prioridad) o footerNav plano
  const navItems: FooterNavItem[] = footerNavTree && footerNavTree.length > 0
    ? buildFooterNavItems(footerNavTree)
    : footerNav && footerNav.length > 0
      ? footerNav.map((p) => ({
          name: p.title,
          href: p.slug === 'home' ? '/' : `/${p.slug}`,
          icon: p.menu_icon,
          badge: p.menu_badge,
        }))
      : (template?.navigation || []).map((n) => ({ name: n.name, href: n.href }))

  // Items de categorías
  const categoryItems = showCategoriesInFooter ? buildCategoryItems(menuCategories!) : []

  const socialIcons = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
  }

  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  // ===== Layout: minimal =====
  if (footerStyle === 'minimal') {
    return (
      <footer className="bg-gray-900 dark:bg-gray-900/80 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              {organization.logo_url ? (
                <Image
                  src={organization.logo_url}
                  alt={organization.name}
                  width={logoHeight * 3}
                  height={logoHeight}
                  className="w-auto object-contain brightness-0 invert"
                  style={{ height: `${logoHeight}px` }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {organization.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Nav inline */}
            <nav className="flex flex-wrap items-center gap-4 justify-center">
              {navItems.slice(0, 6).map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Redes sociales */}
            {Object.keys(socialLinks).length > 0 && (
              <div className="flex space-x-3">
                {Object.entries(socialLinks).map(([platform, url]) => {
                  const Icon = socialIcons[platform as keyof typeof socialIcons]
                  if (!Icon || !url) return null
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800 mt-6 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-gray-400 text-sm">{footerText}</p>
            {showPoweredBy && (
              <p className="text-gray-500 text-sm">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  style={{ color: primaryColor }}
                >
                  GO Admin
                </a>
              </p>
            )}
          </div>
        </div>
      </footer>
    )
  }

  // ===== Layout: centered =====
  if (footerStyle === 'centered') {
    return (
      <footer className="bg-gray-900 dark:bg-gray-900/80 text-white">
        <div className="container mx-auto px-4 py-12">
          {/* Logo + descripción centrados */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              {organization.logo_url ? (
                <Image
                  src={organization.logo_url}
                  alt={organization.name}
                  width={logoHeight * 3}
                  height={logoHeight}
                  className="w-auto object-contain brightness-0 invert"
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
                  <span className="text-xl font-bold">{organization.name}</span>
                </>
              )}
            </div>
            {organization.description && (
              <p className="text-gray-400 max-w-2xl mx-auto">{organization.description}</p>
            )}
          </div>

          {/* Nav centrado */}
          <nav className="flex flex-wrap items-center justify-center gap-6 mb-8">
            {navItems.slice(0, 8).map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                {item.name}
              </Link>
            ))}
            {categoryItems.map((item, i) => (
              <Link
                key={`cat-${i}`}
                href={item.href}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Redes sociales centradas */}
          {Object.keys(socialLinks).length > 0 && (
            <div className="flex justify-center space-x-4 mb-8">
              {Object.entries(socialLinks).map(([platform, url]) => {
                const Icon = socialIcons[platform as keyof typeof socialIcons]
                if (!Icon || !url) return null
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                )
              })}
            </div>
          )}

          {/* Bottom bar */}
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-gray-400 text-sm">{footerText}</p>
            {showPoweredBy && (
              <p className="text-gray-500 text-sm">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  style={{ color: primaryColor }}
                >
                  GO Admin
                </a>
              </p>
            )}
          </div>
        </div>
      </footer>
    )
  }

  // ===== Layout: three_columns =====
  if (footerStyle === 'three_columns') {
    return (
      <footer className="bg-gray-900 dark:bg-gray-900/80 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Columna 1: Logo + descripción + redes */}
            <div>
              <FooterSection title={organization.name}>
                <div className="flex items-center space-x-3 mb-4">
                  {organization.logo_url ? (
                    <Image
                      src={organization.logo_url}
                      alt={organization.name}
                      width={logoHeight * 3}
                      height={logoHeight}
                      className="w-auto object-contain brightness-0 invert"
                      style={{ height: `${logoHeight}px` }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {organization.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                {organization.description && (
                  <p className="text-gray-400 mb-4 text-sm">{organization.description}</p>
                )}
                {Object.keys(socialLinks).length > 0 && (
                  <div className="flex space-x-3">
                    {Object.entries(socialLinks).map(([platform, url]) => {
                      const Icon = socialIcons[platform as keyof typeof socialIcons]
                      if (!Icon || !url) return null
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      )
                    })}
                  </div>
                )}
              </FooterSection>
            </div>

            {/* Columna 2: Enlaces jerárquicos */}
            <div>
              <FooterSection title="Enlaces">
                <ul className="space-y-3">
                  {navItems.length > 0 ? (
                    navItems.slice(0, 8).map((item, i) => (
                      <FooterLinkItem key={i} item={item} />
                    ))
                  ) : (
                    <li className="text-gray-500 text-sm">Sin enlaces</li>
                  )}
                </ul>
              </FooterSection>
            </div>

            {/* Columna 3: Contacto */}
            <div>
              <FooterSection title="Contacto">
                <ul className="space-y-3">
                  {organization.address && (
                    <li className="flex items-start">
                      <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-400 text-sm">
                        {organization.address}
                        {organization.city && <>, {organization.city}</>}
                      </span>
                    </li>
                  )}
                  {organization.phone && (
                    <li className="flex items-center">
                      <Phone className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                      <a href={`tel:${organization.phone}`} className="text-gray-400 hover:text-white transition-colors text-sm">
                        {organization.phone}
                      </a>
                    </li>
                  )}
                  {organization.email && (
                    <li className="flex items-center">
                      <Mail className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                      <a href={`mailto:${organization.email}`} className="text-gray-400 hover:text-white transition-colors text-sm">
                        {organization.email}
                      </a>
                    </li>
                  )}
                </ul>
              </FooterSection>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-gray-400 text-sm">{footerText}</p>
            {showPoweredBy && (
              <p className="text-gray-500 text-sm">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  style={{ color: primaryColor }}
                >
                  GO Admin
                </a>
              </p>
            )}
          </div>
        </div>
      </footer>
    )
  }

  // ===== Layout: default (4 columnas, comportamiento original mejorado) =====
  return (
    <footer className="bg-gray-900 dark:bg-gray-900/80 text-white">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {/* Logo y descripción */}
          <div className="lg:col-span-1">
            <FooterSection title={organization.name}>
              <div className="flex items-center space-x-3 mb-6">
                {organization.logo_url ? (
                  <Image
                    src={organization.logo_url}
                    alt={organization.name}
                    width={logoHeight * 3}
                    height={logoHeight}
                    className="w-auto object-contain brightness-0 invert"
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
                    <span className="text-xl font-bold">{organization.name}</span>
                  </>
                )}
              </div>

              {organization.description && (
                <p className="text-gray-400 mb-6 text-sm">{organization.description}</p>
              )}

              {/* Redes sociales */}
              {Object.keys(socialLinks).length > 0 && (
                <div className="flex space-x-4">
                  {Object.entries(socialLinks).map(([platform, url]) => {
                    const Icon = socialIcons[platform as keyof typeof socialIcons]
                    if (!Icon || !url) return null
                    return (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    )
                  })}
                </div>
              )}
            </FooterSection>
          </div>

          {/* Información de contacto */}
          <div>
            <FooterSection title="Contacto">
              <ul className="space-y-4">
                {organization.address && (
                  <li className="flex items-start">
                    <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-400 text-sm">
                      {organization.address}
                      {organization.city && <>, {organization.city}</>}
                      {organization.state && <>, {organization.state}</>}
                    </span>
                  </li>
                )}
                {organization.phone && (
                  <li className="flex items-center">
                    <Phone className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                    <a href={`tel:${organization.phone}`} className="text-gray-400 hover:text-white transition-colors text-sm">
                      {organization.phone}
                    </a>
                  </li>
                )}
                {organization.email && (
                  <li className="flex items-center">
                    <Mail className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                    <a href={`mailto:${organization.email}`} className="text-gray-400 hover:text-white transition-colors text-sm">
                      {organization.email}
                    </a>
                  </li>
                )}
              </ul>
            </FooterSection>
          </div>

          {/* Horarios (ocultos en móvil si mobile_show_topbar=false) */}
          {Object.keys(businessHours).length > 0 && (settings?.mobile_show_topbar !== false || typeof window === 'undefined') && (
            <div className="hidden md:block">
              <FooterSection title="Horarios">
                <ul className="space-y-2">
                  {daysOfWeek.map((day) => {
                    const dayKey = day.toLowerCase()
                    const hours = businessHours[dayKey]
                    return (
                      <li key={day} className="flex justify-between text-sm">
                        <span className="text-gray-400">{day}</span>
                        <span className="text-gray-300">
                          {hours?.closed ? 'Cerrado' : hours ? `${hours.open} - ${hours.close}` : '-'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </FooterSection>
            </div>
          )}

          {/* Enlaces jerárquicos + Categorías */}
          <div>
            <FooterSection title="Enlaces">
              <ul className="space-y-3">
                {navItems.length > 0 ? (
                  navItems.slice(0, 8).map((item, i) => (
                    <FooterLinkItem key={i} item={item} />
                  ))
                ) : (
                  <>
                    <li>
                      <Link href="/productos" className="text-gray-400 hover:text-white transition-colors text-sm">
                        Productos
                      </Link>
                    </li>
                    <li>
                      <Link href="/servicios" className="text-gray-400 hover:text-white transition-colors text-sm">
                        Servicios
                      </Link>
                    </li>
                    <li>
                      <Link href="/nosotros" className="text-gray-400 hover:text-white transition-colors text-sm">
                        Nosotros
                      </Link>
                    </li>
                    <li>
                      <Link href="/contacto" className="text-gray-400 hover:text-white transition-colors text-sm">
                        Contacto
                      </Link>
                    </li>
                  </>
                )}
              </ul>

              {/* Categorías como sub-sección */}
              {categoryItems.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-800">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Categorías</h4>
                  <ul className="space-y-2">
                    {categoryItems.slice(0, 6).map((cat, i) => (
                      <li key={i}>
                        <Link
                          href={cat.href}
                          className="text-gray-500 hover:text-white transition-colors text-xs flex items-center gap-1.5"
                        >
                          {cat.icon && <span>{cat.icon}</span>}
                          <span>{cat.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </FooterSection>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">{footerText}</p>
            {showPoweredBy && (
              <p className="text-gray-500 text-sm mt-2 md:mt-0">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  style={{ color: primaryColor }}
                >
                  GO Admin
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
