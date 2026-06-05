import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationByHost } from '@/lib/supabase/queries'

export async function GET(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const subdomain = request.headers.get('x-subdomain')
  const customDomain = request.headers.get('x-custom-domain')
  const identifier = customDomain || subdomain

  if (!identifier) {
    return NextResponse.next()
  }

  const organization = await getOrganizationByHost(identifier)
  
  if (!organization) {
    return NextResponse.next()
  }

  const settings = organization.website_settings as any
  const faviconUrl = settings?.favicon_url || organization.logo_url

  if (!faviconUrl) {
    return NextResponse.next()
  }

  // Redirigir al favicon real con headers CORS apropiados
  try {
    const response = await fetch(faviconUrl)
    if (!response.ok) {
      return NextResponse.next()
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/x-icon'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    })
  } catch (error) {
    return NextResponse.next()
  }
}
