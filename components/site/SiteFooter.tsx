import Link from 'next/link'
import Image from 'next/image'
import { Facebook, Twitter, Instagram, Linkedin, Youtube, MapPin, Phone, Mail, Clock } from 'lucide-react'
import type { OrganizationWithDetails, WebsiteSettings, WebsitePage, Json } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface SiteFooterProps {
  organization: OrganizationWithDetails
  settings: WebsiteSettings | null
  primaryColor: string
  template?: TemplateConfig
  footerNav?: WebsitePage[]
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

export function SiteFooter({ organization, settings, primaryColor, template, footerNav }: SiteFooterProps) {
  const socialLinks = (settings?.social_links || {}) as SocialLinks
  const businessHours = (settings?.business_hours || {}) as BusinessHours
  const footerText = settings?.footer_text || `© ${new Date().getFullYear()} ${organization.name}. Todos los derechos reservados.`
  const showPoweredBy = settings?.show_powered_by !== false
  const logoHeight = settings?.logo_height || 48
  
  // Prioridad: footerNav (website_pages) > template.navigation > vacío
  const navItems = footerNav && footerNav.length > 0
    ? footerNav.map(p => ({ name: p.title, href: p.slug === 'home' ? '/' : `/${p.slug}` }))
    : template?.navigation || []
  
  const socialIcons = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
  }
  
  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  
  return (
    <footer className="bg-gray-900 dark:bg-gray-900/80 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Logo y descripción */}
          <div className="lg:col-span-1">
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
              <p className="text-gray-400 mb-6">
                {organization.description}
              </p>
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
                      style={{ '--hover-color': primaryColor } as any}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>
          
          {/* Información de contacto */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Contacto</h3>
            <ul className="space-y-4">
              {organization.address && (
                <li className="flex items-start">
                  <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400">
                    {organization.address}
                    {organization.city && <>, {organization.city}</>}
                    {organization.state && <>, {organization.state}</>}
                  </span>
                </li>
              )}
              {organization.phone && (
                <li className="flex items-center">
                  <Phone className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                  <a href={`tel:${organization.phone}`} className="text-gray-400 hover:text-white transition-colors">
                    {organization.phone}
                  </a>
                </li>
              )}
              {organization.email && (
                <li className="flex items-center">
                  <Mail className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                  <a href={`mailto:${organization.email}`} className="text-gray-400 hover:text-white transition-colors">
                    {organization.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
          
          {/* Horarios */}
          {Object.keys(businessHours).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-6">Horarios</h3>
              <ul className="space-y-2">
                {daysOfWeek.map((day, index) => {
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
            </div>
          )}
          
          {/* Links rápidos */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Enlaces</h3>
            <ul className="space-y-3">
              {navItems.length > 0 ? (
                navItems.slice(0, 6).map((item) => (
                  <li key={item.name}>
                    <Link 
                      href={item.href} 
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <Link href="/productos" className="text-gray-400 hover:text-white transition-colors">
                      Productos
                    </Link>
                  </li>
                  <li>
                    <Link href="/servicios" className="text-gray-400 hover:text-white transition-colors">
                      Servicios
                    </Link>
                  </li>
                  <li>
                    <Link href="/nosotros" className="text-gray-400 hover:text-white transition-colors">
                      Nosotros
                    </Link>
                  </li>
                  <li>
                    <Link href="/contacto" className="text-gray-400 hover:text-white transition-colors">
                      Contacto
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              {footerText}
            </p>
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
