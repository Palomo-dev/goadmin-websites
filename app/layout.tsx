import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { headers } from 'next/headers'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain

  let faviconIcon: string | undefined
  if (identifier) {
    const organization = await getOrganizationByHost(identifier)
    if (organization) {
      const settings = organization.website_settings as any
      const faviconUrl = settings?.favicon_url || organization.logo_url
      if (faviconUrl) {
        faviconIcon = faviconUrl
      }
    }
  }

  return {
    title: {
      default: 'Sitio Web | Powered by GO Admin',
      template: '%s | GO Admin'
    },
    description: 'Plataforma de sitios web para negocios',
    icons: faviconIcon ? {
      icon: faviconIcon,
      apple: faviconIcon,
    } : undefined,
    openGraph: {
      title: 'Sitio Web | GO Admin',
      description: 'Plataforma de sitios web para negocios',
      type: 'website',
      locale: 'es_ES',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Sitio Web | GO Admin',
      description: 'Plataforma de sitios web para negocios',
    },
  }
}

export default function RootLayout({
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
