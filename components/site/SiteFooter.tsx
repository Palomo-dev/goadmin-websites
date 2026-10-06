'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Facebook, Twitter, Instagram, Linkedin, Youtube, MapPin, Phone, Mail, Clock, ChevronDown, MessageCircle } from 'lucide-react'
import type { OrganizationWithDetails, WebsiteSettings, WebsitePage, WebsitePageWithChildren, WebsiteMenuWithItems, WebsiteMenuItemWithChildren, Json } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'
import type { MenuCategory } from './header/HeaderShared'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { prefijarItemsNav } from '@/lib/outlet/rutaSitio'
import { filasHorario, normalizarDias, parseHorario, type HorarioSemana } from '@/lib/restaurant/horario'
import { useEncabezadoPie } from './EncabezadoPieContext'
import { useTemaColores } from './TemaColoresContext'
import { BotonWhatsappPie, IconoTikTok, MapaPie, MediosPagoPie } from './footer/PieExtras'
import { PieTema } from './footer/PieTema'

interface SiteFooterProps {
  organization: OrganizationWithDetails
  settings: WebsiteSettings | null
  primaryColor: string
  template?: TemplateConfig
  footerNav?: WebsitePage[]
  footerNavTree?: WebsitePageWithChildren[]
  menuCategories?: MenuCategory[]
  menus?: WebsiteMenuWithItems[]
  /**
   * Horario de la sede (`branches.opening_hours`, ya revisado: el por defecto del ERP no
   * llega). Si es null se usa `website_settings.business_hours`.
   */
  horarioSede?: HorarioSemana | null
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

// Convierte items de un menú nombrado a FooterNavItem[]
function buildMenuGroupItems(items: WebsiteMenuItemWithChildren[]): FooterNavItem[] {
  return items.map((item) => {
    let name = item.custom_label || ''
    let href = item.custom_url || '#'

    if (item.item_type === 'page' || item.item_type === 'policy') {
      if (item.page) {
        name = item.page.title
        href = item.page.slug === 'home' ? '/' : `/${item.page.slug}`
      }
    } else if (item.item_type === 'category') {
      if (item.category) {
        name = item.category.name
        href = `/categorias/${item.category.slug}`
      }
    }

    return {
      name,
      href,
      icon: item.icon,
      badge: item.badge,
      children: item.children.length > 0 ? buildMenuGroupItems(item.children) : undefined,
    }
  })
}

// Clase de fondo del footer según configuración
function getFooterBgClass(bg: string | undefined, customColor: string | null | undefined): string {
  switch (bg) {
    case 'light':
      return 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
    case 'primary':
      return 'text-white'
    case 'custom':
      return customColor ? '' : 'bg-gray-900 dark:bg-gray-900/80 text-white'
    default:
      return 'bg-gray-900 dark:bg-gray-900/80 text-white'
  }
}

// Clase de grid dinámico según número de columnas
function getFooterGridClass(columns: number | undefined): string {
  switch (columns) {
    case 2:
      return 'grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12'
    case 3:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12'
    case 5:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-12'
    default:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12'
  }
}

// Sección colapsable en móvil con <details> — render único de contenido
function FooterSection({
  title,
  children,
  mobileStyle = 'accordion',
}: {
  title: string
  children: React.ReactNode
  mobileStyle?: 'accordion' | 'stacked' | 'hidden'
}) {
  // hidden: solo desktop
  if (mobileStyle === 'hidden') {
    return (
      <div className="hidden md:block">
        <h3 className="text-lg font-semibold mb-6 text-white">{title}</h3>
        {children}
      </div>
    )
  }

  // stacked: siempre visible, sin accordion
  if (mobileStyle === 'stacked') {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4 text-white">{title}</h3>
        {children}
      </div>
    )
  }

  // accordion (default): details en móvil, título fijo en desktop — children renderizados una sola vez
  return (
    <details className="group border-b border-white/20 md:border-0" open>
      <summary className="flex items-center justify-between cursor-pointer py-4 text-lg font-semibold text-white list-none md:cursor-default md:py-0 md:mb-6">
        <span>{title}</span>
        <ChevronDown className="h-5 w-5 text-current opacity-50 group-open:rotate-180 transition-transform md:hidden" />
      </summary>
      <div className="pb-4 md:pb-0">{children}</div>
    </details>
  )
}

// Renderiza un link de footer con sub-links indentados
function FooterLinkItem({ item }: { item: FooterNavItem }) {
  const hasChildren = item.children && item.children.length > 0

  return (
    <li>
      <Link
        href={item.href}
        className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm flex items-center gap-1.5"
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
        <ul className="ml-3 mt-2 space-y-2 border-l border-white/20 pl-3">
          {item.children!.map((child, j) => (
            <li key={j}>
              <Link
                href={child.href}
                className="text-current opacity-50 hover:opacity-100 transition-opacity text-xs"
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
  menus,
  horarioSede = null,
}: SiteFooterProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const { prefijo, ruta } = useRutaSitio()
  // Encabezado y pie por plantilla: WhatsApp, mapa y medios de pago (cada uno null con su opción
  // apagada). Sitio V2 con tema: el pie de las láminas (PieTema). Legacy: igual que antes.
  const { opciones: opcionesShell } = useEncabezadoPie()
  const temaColores = useTemaColores()
  const socialLinks = (settings?.social_links || {}) as SocialLinks
  // Horario legible: el de la sede si lo hay; si no, business_hours (se guarda con los días en
  // español y sin tildes: «miercoles», «sabado»). Vacío o ilegible → no hay bloque «Horarios».
  const horarioPie = horarioSede ?? parseHorario(normalizarDias(settings?.business_hours))
  const filasHorarioPie = horarioPie ? filasHorario(horarioPie, null) : []
  const footerText = settings?.footer_text || `© ${new Date().getFullYear()} ${organization.name}. Todos los derechos reservados.`
  const showPoweredBy = settings?.show_powered_by !== false
  const logoHeight = settings?.logo_height || 48
  const footerStyle = settings?.footer_style || 'default'

  // Configuración nueva (Fase 5)
  const footerBackground = settings?.footer_background || 'dark'
  const footerCustomBgColor = settings?.footer_custom_bg_color ?? null
  const footerColumns = settings?.footer_columns || 4
  const footerShowContact = settings?.footer_show_contact !== false
  const footerShowHours = settings?.footer_show_hours !== false
  const footerShowSocial = settings?.footer_show_social !== false
  const footerShowNewsletter = settings?.footer_show_newsletter ?? false
  const footerShowCategories = settings?.footer_show_categories ?? false
  const mobileFooterStyle = (settings?.mobile_footer_style || 'accordion') as 'accordion' | 'stacked' | 'hidden'
  const mobileFooterShowSocial = settings?.mobile_footer_show_social ?? true
  const mobileFooterShowHours = settings?.mobile_footer_show_hours ?? true
  const footerNewsletterTitle = settings?.footer_newsletter_title || 'Suscríbete'
  const footerNewsletterPlaceholder = settings?.footer_newsletter_placeholder || 'Tu email'
  const footerNewsletterButtonText = settings?.footer_newsletter_button_text || 'Suscribir'

  // Clases dinámicas
  const footerBgClass = getFooterBgClass(footerBackground, footerCustomBgColor)
  const footerBgStyle = footerBackground === 'primary'
    ? { backgroundColor: primaryColor }
    : footerBackground === 'custom' && footerCustomBgColor
      ? { backgroundColor: footerCustomBgColor }
      : undefined
  const footerGridClass = getFooterGridClass(footerColumns)

  // Visibilidad de redes y horarios en móvil
  const showSocialInFooter = footerShowSocial && Object.keys(socialLinks).length > 0
  const showSocialInMobile = footerShowSocial && mobileFooterShowSocial && Object.keys(socialLinks).length > 0
  const showHoursInFooter = footerShowHours && filasHorarioPie.length > 0
  const showHoursInMobile = footerShowHours && mobileFooterShowHours && filasHorarioPie.length > 0

  // Categorías en footer (nuevo flag o fallback al anterior)
  const showCategoriesInFooter =
    (footerShowCategories || settings?.show_categories_in_header === true) &&
    !!menuCategories &&
    menuCategories.length > 0

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
      : prefijarItemsNav((template?.navigation || []).map((n) => ({ name: n.name, href: n.href })), prefijo) ?? []

  // Items de categorías (con el prefijo de la sede si se sirve por ruta)
  const categoryItems = showCategoriesInFooter ? prefijarItemsNav(buildCategoryItems(menuCategories!), prefijo) ?? [] : []

  // Menús nombrados agrupados por columna (sistema nuevo)
  const footerMenusByColumn: Record<number, FooterNavItem[]> = {}
  if (menus && menus.length > 0) {
    for (const menu of menus) {
      const col = menu.footer_column ?? 1
      if (!footerMenusByColumn[col]) footerMenusByColumn[col] = []
      footerMenusByColumn[col].push(...(prefijarItemsNav(buildMenuGroupItems(menu.items), prefijo) ?? []))
    }
  }
  const hasFooterMenus = Object.keys(footerMenusByColumn).length > 0

  // TikTok: ningún sitio lo tenía (se omitía). WhatsApp en redes: solo con footer_show_whatsapp,
  // para no cambiar los sitios que lo tienen en social_links y hoy no lo muestran.
  const socialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
    tiktok: IconoTikTok,
    ...(opcionesShell.pie.whatsapp ? { whatsapp: MessageCircle } : {}),
  }

  // ===== Sitio V2 con tema: el pie de las láminas de Figma (footer/PieTema.tsx) =====
  // Legacy (sin tema) sigue por sus cinco composiciones de abajo, sin cambios.
  if (temaColores) {
    return (
      <PieTema
        organization={organization}
        primaryColor={primaryColor}
        composicion={footerStyle}
        claseFondo={footerBgClass}
        estiloFondo={footerBgStyle}
        menus={menus}
        redes={socialLinks as Record<string, string | undefined>}
        textoPie={settings?.footer_text || ''}
        mostrarHechoCon={showPoweredBy}
        mostrarContacto={footerShowContact}
        mostrarHorario={footerShowHours}
        mostrarRedes={footerShowSocial}
        logoHeight={logoHeight}
      />
    )
  }

  // ===== Layout: minimal =====
  if (footerStyle === 'minimal') {
    return (
      <footer className={footerBgClass} style={footerBgStyle}>
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
                  className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <BotonWhatsappPie whatsappRedes={socialLinks.whatsapp} />

            {/* Redes sociales */}
            {showSocialInFooter && (
              <div className="flex space-x-3">
                {Object.entries(socialLinks).map(([platform, url]) => {
                  const Icon = socialIcons[platform]
                  if (!Icon || !url) return null
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          <MapaPie className="mt-6" />

          {/* Bottom bar */}
          <div className="border-t border-white/20 mt-6 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-current opacity-50 text-sm">{footerText}</p>
            <MediosPagoPie />
            {showPoweredBy && (
              <p className="text-current opacity-50 text-sm">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
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
      <footer className={footerBgClass} style={footerBgStyle}>
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
              <p className="text-current opacity-50 max-w-2xl mx-auto">{organization.description}</p>
            )}
          </div>

          {/* Nav centrado */}
          <nav className="flex flex-wrap items-center justify-center gap-6 mb-8">
            {navItems.slice(0, 8).map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm"
              >
                {item.name}
              </Link>
            ))}
            {categoryItems.map((item, i) => (
              <Link
                key={`cat-${i}`}
                href={item.href}
                className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Redes sociales centradas */}
          {showSocialInFooter && (
            <div className="flex justify-center space-x-4 mb-8">
              {Object.entries(socialLinks).map(([platform, url]) => {
                const Icon = socialIcons[platform]
                if (!Icon || !url) return null
                return (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                )
              })}
            </div>
          )}

          <div className="flex justify-center mb-8 empty:hidden">
            <BotonWhatsappPie whatsappRedes={socialLinks.whatsapp} />
          </div>

          <MapaPie className="mb-8 mx-auto max-w-md" />

          {/* Bottom bar */}
          <div className="border-t border-white/20 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-current opacity-50 text-sm">{footerText}</p>
            <MediosPagoPie />
            {showPoweredBy && (
              <p className="text-current opacity-50 text-sm">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
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
      <footer className={footerBgClass} style={footerBgStyle}>
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
                  <p className="text-current opacity-50 mb-4 text-sm">{organization.description}</p>
                )}
                {showSocialInFooter && (
                  <div className="flex space-x-3">
                    {Object.entries(socialLinks).map(([platform, url]) => {
                      const Icon = socialIcons[platform]
                      if (!Icon || !url) return null
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      )
                    })}
                  </div>
                )}
                <BotonWhatsappPie whatsappRedes={socialLinks.whatsapp} className="mt-4" />
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
                    <li className="text-current opacity-50 text-sm">Sin enlaces</li>
                  )}
                </ul>
              </FooterSection>
            </div>

            {/* Columna 3: Contacto */}
            {footerShowContact && (
            <div>
              <FooterSection title="Contacto">
                <ul className="space-y-3">
                  {organization.address && (
                    <li className="flex items-start">
                      <MapPin className="h-5 w-5 text-current opacity-50 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-current opacity-50 text-sm">
                        {organization.address}
                        {organization.city && <>, {organization.city}</>}
                      </span>
                    </li>
                  )}
                  {organization.phone && (
                    <li className="flex items-center">
                      <Phone className="h-5 w-5 text-current opacity-50 mr-3 flex-shrink-0" />
                      <a href={`tel:${organization.phone}`} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                        {organization.phone}
                      </a>
                    </li>
                  )}
                  {organization.email && (
                    <li className="flex items-center">
                      <Mail className="h-5 w-5 text-current opacity-50 mr-3 flex-shrink-0" />
                      <a href={`mailto:${organization.email}`} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                        {organization.email}
                      </a>
                    </li>
                  )}
                </ul>
                <MapaPie className="mt-6" />
              </FooterSection>
            </div>
            )}

          </div>

          {/* Mapa también cuando el contacto está oculto */}
          {!footerShowContact && <MapaPie className="mt-8 max-w-md" />}

          {/* Bottom bar */}
          <div className="border-t border-white/20 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-current opacity-50 text-sm">{footerText}</p>
            <MediosPagoPie />
            {showPoweredBy && (
              <p className="text-current opacity-50 text-sm">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
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

  // ===== Layout: split (2 columnas: branding | enlaces) =====
  if (footerStyle === 'split') {
    return (
      <footer className={footerBgClass} style={footerBgStyle}>
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
            {/* Columna izquierda: Logo + descripción + redes + contacto */}
            <div>
              <FooterSection title={organization.name} mobileStyle={mobileFooterStyle}>
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
                  <p className="text-current opacity-50 mb-6 text-sm max-w-md">{organization.description}</p>
                )}

                {showSocialInFooter && (
                  <div className="flex space-x-4 mb-6">
                    {Object.entries(socialLinks).map(([platform, url]) => {
                      const Icon = socialIcons[platform]
                      if (!Icon || !url) return null
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                        >
                          <Icon className="h-5 w-5" />
                        </a>
                      )
                    })}
                  </div>
                )}

                <BotonWhatsappPie whatsappRedes={socialLinks.whatsapp} className="mb-6" />

                {footerShowContact && (
                  <ul className="space-y-3">
                    {organization.address && (
                      <li className="flex items-start">
                        <MapPin className="h-5 w-5 text-current opacity-50 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-current opacity-50 text-sm">
                          {organization.address}
                          {organization.city && <>, {organization.city}</>}
                        </span>
                      </li>
                    )}
                    {organization.phone && (
                      <li className="flex items-center">
                        <Phone className="h-5 w-5 text-current opacity-50 mr-3 flex-shrink-0" />
                        <a href={`tel:${organization.phone}`} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                          {organization.phone}
                        </a>
                      </li>
                    )}
                    {organization.email && (
                      <li className="flex items-center">
                        <Mail className="h-5 w-5 text-current opacity-50 mr-3 flex-shrink-0" />
                        <a href={`mailto:${organization.email}`} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                          {organization.email}
                        </a>
                      </li>
                    )}
                  </ul>
                )}
                <MapaPie className="mt-6 max-w-md" />
              </FooterSection>
            </div>

            {/* Columna derecha: Enlaces + categorías + newsletter en sub-grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Enlaces */}
              <div>
                <FooterSection title="Enlaces" mobileStyle={mobileFooterStyle}>
                  <ul className="space-y-3">
                    {navItems.length > 0 ? (
                      navItems.slice(0, 8).map((item, i) => (
                        <FooterLinkItem key={i} item={item} />
                      ))
                    ) : (
                      <li className="text-current opacity-50 text-sm">Sin enlaces</li>
                    )}
                  </ul>

                  {categoryItems.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/20">
                      <h4 className="text-sm font-semibold text-current opacity-70 mb-3">Categorías</h4>
                      <ul className="space-y-2">
                        {categoryItems.slice(0, 6).map((cat, i) => (
                          <li key={i}>
                            <Link href={cat.href} className="text-current opacity-50 hover:opacity-100 transition-opacity text-xs flex items-center gap-1.5">
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

              {/* Horarios + Newsletter */}
              <div>
                {showHoursInFooter && (
                  <FooterSection title="Horarios" mobileStyle={showHoursInMobile ? mobileFooterStyle : 'hidden'}>
                    <ul className="space-y-2">
                      {filasHorarioPie.map((fila) => (
                        <li key={fila.etiqueta} className="flex justify-between gap-3 text-sm">
                          <span className="text-current opacity-50">{fila.etiqueta}</span>
                          <span className="text-current opacity-70 text-right">{fila.horas ?? 'Cerrado'}</span>
                        </li>
                      ))}
                    </ul>
                  </FooterSection>
                )}

                {footerShowNewsletter && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4 text-white">{footerNewsletterTitle}</h3>
                    <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                      <input
                        type="email"
                        placeholder={footerNewsletterPlaceholder}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-current text-sm placeholder-current opacity-60 focus:outline-none focus:border-white/40"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {footerNewsletterButtonText}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/20 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-current opacity-50 text-sm">{footerText}</p>
            <MediosPagoPie />
            {showPoweredBy && (
              <p className="text-current opacity-50 text-sm">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
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

  // ===== Layout: default (columnas dinámicas, comportamiento original mejorado) =====
  return (
    <footer className={footerBgClass} style={footerBgStyle}>
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className={footerGridClass}>
          {/* Logo y descripción */}
          <div className="lg:col-span-1">
            <FooterSection title={organization.name} mobileStyle={mobileFooterStyle}>
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
                <p className="text-current opacity-50 mb-6 text-sm">{organization.description}</p>
              )}

              {/* Redes sociales */}
              {showSocialInFooter && (
                <div className="flex space-x-4">
                  {Object.entries(socialLinks).map(([platform, url]) => {
                    const Icon = socialIcons[platform]
                    if (!Icon || !url) return null
                    return (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    )
                  })}
                </div>
              )}
              <BotonWhatsappPie whatsappRedes={socialLinks.whatsapp} className="mt-5" />
            </FooterSection>
          </div>

          {/* Información de contacto */}
          {footerShowContact && (
          <div>
            <FooterSection title="Contacto" mobileStyle={mobileFooterStyle}>
              <ul className="space-y-4">
                {organization.address && (
                  <li className="flex items-start">
                    <MapPin className="h-5 w-5 text-current opacity-50 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-current opacity-50 text-sm">
                      {organization.address}
                      {organization.city && <>, {organization.city}</>}
                      {organization.state && <>, {organization.state}</>}
                    </span>
                  </li>
                )}
                {organization.phone && (
                  <li className="flex items-center">
                    <Phone className="h-5 w-5 text-current opacity-50 mr-3 flex-shrink-0" />
                    <a href={`tel:${organization.phone}`} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                      {organization.phone}
                    </a>
                  </li>
                )}
                {organization.email && (
                  <li className="flex items-center">
                    <Mail className="h-5 w-5 text-current opacity-50 mr-3 flex-shrink-0" />
                    <a href={`mailto:${organization.email}`} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                      {organization.email}
                    </a>
                  </li>
                )}
              </ul>
            </FooterSection>
          </div>
          )}

          {/* Horarios */}
          {showHoursInFooter && (
            <div>
              <FooterSection title="Horarios" mobileStyle={showHoursInMobile ? mobileFooterStyle : 'hidden'}>
                <ul className="space-y-2">
                  {filasHorarioPie.map((fila) => (
                    <li key={fila.etiqueta} className="flex justify-between gap-3 text-sm">
                      <span className="text-current opacity-50">{fila.etiqueta}</span>
                      <span className="text-current opacity-70 text-right">{fila.horas ?? 'Cerrado'}</span>
                    </li>
                  ))}
                </ul>
              </FooterSection>
            </div>
          )}

          {/* Enlaces jerárquicos + Categorías + Newsletter */}
          <div>
            <FooterSection title="Enlaces" mobileStyle={mobileFooterStyle}>
              <ul className="space-y-3">
                {navItems.length > 0 ? (
                  navItems.slice(0, 8).map((item, i) => (
                    <FooterLinkItem key={i} item={item} />
                  ))
                ) : (
                  <>
                    <li>
                      <Link href={ruta('/productos')} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                        Productos
                      </Link>
                    </li>
                    <li>
                      <Link href={ruta('/servicios')} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                        Servicios
                      </Link>
                    </li>
                    <li>
                      <Link href={ruta('/nosotros')} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                        Nosotros
                      </Link>
                    </li>
                    <li>
                      <Link href={ruta('/contacto')} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                        Contacto
                      </Link>
                    </li>
                  </>
                )}
              </ul>

              {/* Categorías como sub-sección */}
              {categoryItems.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/20">
                  <h4 className="text-sm font-semibold text-current opacity-70 mb-3">Categorías</h4>
                  <ul className="space-y-2">
                    {categoryItems.slice(0, 6).map((cat, i) => (
                      <li key={i}>
                        <Link
                          href={cat.href}
                          className="text-current opacity-50 hover:opacity-100 transition-opacity text-xs flex items-center gap-1.5"
                        >
                          {cat.icon && <span>{cat.icon}</span>}
                          <span>{cat.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Newsletter */}
              {footerShowNewsletter && (
                <div className="mt-6 pt-4 border-t border-white/20">
                  <h4 className="text-sm font-semibold text-current opacity-70 mb-3">{footerNewsletterTitle}</h4>
                  <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                    <input
                      type="email"
                      placeholder={footerNewsletterPlaceholder}
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-current text-sm placeholder-current opacity-60 focus:outline-none focus:border-white/40"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {footerNewsletterButtonText}
                    </button>
                  </form>
                </div>
              )}
            </FooterSection>
          </div>

          {/* Mapa con «Cómo llegar» (footer_show_map) */}
          {opcionesShell.pie.mapa && (
            <div>
              <MapaPie />
            </div>
          )}

          {/* Menús nombrados en columnas adicionales (sistema nuevo) */}
          {hasFooterMenus && Object.entries(footerMenusByColumn)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([col, items]) => (
              <div key={`menu-col-${col}`}>
                <FooterSection title="Enlaces" mobileStyle={mobileFooterStyle}>
                  <ul className="space-y-3">
                    {items.map((item, i) => (
                      <FooterLinkItem key={i} item={item} />
                    ))}
                  </ul>
                </FooterSection>
              </div>
            ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-current opacity-50 text-sm">{footerText}</p>
            <MediosPagoPie className="mt-2 md:mt-0" />
            {showPoweredBy && (
              <p className="text-current opacity-50 text-sm mt-2 md:mt-0">
                Powered by{' '}
                <a
                  href="https://goadmin.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
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
