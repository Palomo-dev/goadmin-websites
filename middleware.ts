import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Dominios del sistema donde se sirven los sitios de organizaciones
const SYSTEM_DOMAINS = ['goadmin.io']

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  
  // Ignorar rutas de assets estáticos (pero NO /api, para que auth funcione)
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.') // archivos con extensión
  ) {
    return NextResponse.next()
  }

  // --- Refresco de sesión Supabase Auth ---
  // Esto mantiene las cookies de sesión JWT válidas entre requests
  let supabaseResponse = NextResponse.next({ request })

  // Usar service role key si disponible (la anon key falla en runtime de Vercel)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: No usar getSession() aquí, getUser() valida contra el servidor
  await supabase.auth.getUser()

  // --- Lógica de subdominios / dominios personalizados ---
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
    return supabaseResponse
  }
  
  // Agregar headers con información del tenant al response de Supabase
  if (subdomain) {
    supabaseResponse.headers.set('x-subdomain', subdomain)
  }
  
  if (isCustomDomain) {
    supabaseResponse.headers.set('x-custom-domain', hostname)
  }
  
  return supabaseResponse
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
