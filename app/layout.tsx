import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { headers } from 'next/headers'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { getPixelesSitio } from '@/lib/seo/pixelesSitio'
import './globals.css'

// Nota: custom_scripts se inyectan client-side vía CustomScripts en
// OrganizationLayout (useEffect). Esto es necesario porque el Event Setup
// Tool de Meta abre la web en un iframe e inyecta un interceptor JS para
// detectar llamadas fbq('init'). Si los scripts se ejecutan en SSR (head),
// lo hacen ANTES de que Meta instale su interceptor, y no los detecta.

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain

  let faviconIcon: string | undefined
  let orgName: string | undefined
  // «Ocultar de los buscadores» (Sitio web › SEO y redes): noindex en todas las páginas que no
  // fijan su propio `robots`. Sin la columna (migración sin aplicar) es false: como hoy.
  let noindex = false
  if (identifier) {
    const organization = await getOrganizationByHost(identifier)
    if (organization) {
      noindex = (await getPixelesSitio(organization.id)).noindex
      orgName = organization.name || undefined
      const settings = organization.website_settings as any
      const faviconUrl = settings?.favicon_url || organization.logo_url
      if (faviconUrl) {
        faviconIcon = faviconUrl
      }
    }
  }

  const defaultTitle = orgName || 'Sitio Web'

  return {
    title: {
      default: defaultTitle,
      template: '%s'
    },
    description: 'Plataforma de sitios web para negocios',
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    icons: faviconIcon ? {
      icon: faviconIcon,
      apple: faviconIcon,
    } : undefined,
    openGraph: {
      title: defaultTitle,
      description: 'Plataforma de sitios web para negocios',
      type: 'website',
      locale: 'es_ES',
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: 'Plataforma de sitios web para negocios',
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
