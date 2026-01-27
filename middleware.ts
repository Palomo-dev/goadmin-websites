import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Dominios del sistema donde se sirven los sitios de organizaciones
const SYSTEM_DOMAINS = ['goadmin.io']

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  
  // Ignorar rutas de assets y API
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.') // archivos con extensión
  ) {
    return NextResponse.next()
  }
  
  // Detectar si es un subdominio del sistema
  const isSystemDomain = SYSTEM_DOMAINS.some(d => hostname.endsWith(d))
  const isLocalhost = hostname.includes('localhost')
  
  let subdomain: string | null = null
  let isCustomDomain = false
  
  if (isLocalhost) {
    // En desarrollo, usar query param o header para simular subdominio
    subdomain = url.searchParams.get('subdomain') || request.headers.get('x-subdomain')
    
    if (!subdomain) {
      // También intentar extraer del hostname si es algo como subdomain.localhost
      const parts = hostname.split('.')
      if (parts.length > 1 && parts[0] !== 'localhost') {
        subdomain = parts[0]
      }
    }
  } else if (isSystemDomain) {
    // Extraer subdominio de hostname como "subdomain.goadmin.io"
    const parts = hostname.split('.')
    if (parts.length > 2) {
      subdomain = parts[0]
    }
  } else {
    // Es un dominio personalizado
    isCustomDomain = true
  }
  
  // Si no hay subdominio ni dominio personalizado, mostrar página de error o landing
  if (!subdomain && !isCustomDomain) {
    // Permitir acceso a la página principal sin subdominio
    return NextResponse.next()
  }
  
  // Agregar headers con información del tenant
  const response = NextResponse.next()
  
  if (subdomain) {
    response.headers.set('x-subdomain', subdomain)
  }
  
  if (isCustomDomain) {
    response.headers.set('x-custom-domain', hostname)
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
