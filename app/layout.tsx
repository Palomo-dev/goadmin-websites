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
  let orgName: string | undefined
  if (identifier) {
    const organization = await getOrganizationByHost(identifier)
    if (organization) {
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

/**
 * Parsea custom_scripts HTML para extraer tags <script> y <noscript>.
 * Server-side — usa regex para no depender del DOM.
 * Esto hace que crawlers como Meta Events Manager detecten el pixel
 * sin necesidad de ejecutar JavaScript.
 */
function parseCustomScripts(html: string) {
  const scripts: { id: string; src?: string; innerHTML?: string }[] = []
  const noscripts: { id: string; innerHTML: string }[] = []

  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  let idx = 0
  while ((match = scriptRegex.exec(html)) !== null) {
    const attrsStr = match[1] || ''
    const content = match[2] || ''
    const srcMatch = attrsStr.match(/src\s*=\s*"([^"]*)"/i)
    scripts.push({
      id: `custom-script-${idx}`,
      src: srcMatch ? srcMatch[1] : undefined,
      innerHTML: content.trim() || undefined,
    })
    idx++
  }

  const noscriptRegex = /<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi
  let nidx = 0
  while ((match = noscriptRegex.exec(html)) !== null) {
    noscripts.push({
      id: `custom-noscript-${nidx}`,
      innerHTML: (match[1] || '').trim(),
    })
    nidx++
  }

  return { scripts, noscripts }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Obtener custom_scripts de la organización para inyectar en <head> via SSR.
  // Esto hace que crawlers como Meta Events Manager detecten el pixel
  // sin necesidad de ejecutar JavaScript.
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain

  let customScriptsHtml: string | null = null
  if (identifier) {
    const organization = await getOrganizationByHost(identifier)
    if (organization) {
      const settings = organization.website_settings as any
      // Los settings pueden ser un array (PostgREST) o un objeto
      const settingsObj = Array.isArray(settings) ? settings[0] : settings
      customScriptsHtml = settingsObj?.custom_scripts || null
    }
  }

  const parsed = customScriptsHtml ? parseCustomScripts(customScriptsHtml) : { scripts: [], noscripts: [] }

  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {parsed.scripts.map((s) =>
          s.src ? (
            <script key={s.id} id={s.id} src={s.src} async />
          ) : (
            <script
              key={s.id}
              id={s.id}
              dangerouslySetInnerHTML={{ __html: s.innerHTML || '' }}
            />
          )
        )}
        {parsed.noscripts.map((ns) => (
          <noscript
            key={ns.id}
            dangerouslySetInnerHTML={{ __html: ns.innerHTML }}
          />
        ))}
      </head>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
