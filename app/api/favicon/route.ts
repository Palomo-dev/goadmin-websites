import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getOrganizationByHost } from '@/lib/supabase/queries'

const SYSTEM_DOMAINS = ['goadmin.io']

export async function GET(request: NextRequest) {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  let identifier = customDomain || subdomain

  // Fallback: extraer del hostname directamente
  if (!identifier) {
    const hostname = request.headers.get('host') || ''
    const isSystemDomain = SYSTEM_DOMAINS.some(d => hostname.endsWith(d))
    if (isSystemDomain) {
      const parts = hostname.split('.')
      if (parts.length > 2) identifier = parts[0]
    } else if (!hostname.includes('localhost')) {
      identifier = hostname
    }
  }

  if (!identifier) {
    return new NextResponse(null, { status: 404 })
  }

  const organization = await getOrganizationByHost(identifier)
  
  if (!organization) {
    return new NextResponse(null, { status: 404 })
  }

  const settings = organization.website_settings as any
  const faviconUrl = settings?.favicon_url || organization.logo_url

  if (!faviconUrl) {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const response = await fetch(faviconUrl)
    if (!response.ok) {
      return new NextResponse(null, { status: 404 })
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
