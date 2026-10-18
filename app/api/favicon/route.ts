import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { urlFaviconDeLaPeticion } from '@/lib/website/faviconDeOrganizacion'
import { urlFaviconParaFetch } from '@/lib/website/v2/faviconPublico'

export async function GET() {
  const faviconUrl = await urlFaviconDeLaPeticion()
  if (!faviconUrl) {
    return new NextResponse(null, { status: 404 })
  }

  const absoluta = urlFaviconParaFetch(faviconUrl, await headers())
  if (!absoluta) {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const response = await fetch(absoluta)
    if (!response.ok) {
      return new NextResponse(null, { status: 404 })
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        // Corto a propósito: antes era un día y un logo cacheado tapaba el favicon nuevo.
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
