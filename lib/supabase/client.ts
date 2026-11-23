import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { Database } from '@/types/database'
import { hayMarcaSesionCorta, opcionesCookieSesion } from '@/lib/auth/sesionCorta'

/**
 * Cliente de Supabase del navegador. Las cookies se leen y escriben en `document.cookie` igual que
 * la implementación por defecto de @supabase/ssr (mismo parse y serialize), con una diferencia:
 * con «Recordarme» sin marcar (marca `gs_sesion_corta`) las cookies de sesión que escribe
 * setSession o el refresco automático van sin vencimiento (lib/auth/sesionCorta.ts). El cliente es
 * único por página (la librería lo guarda), por eso la marca se mira en cada escritura.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? '' }))
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          const corta = hayMarcaSesionCorta(document.cookie)
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookieHeader(name, value, opcionesCookieSesion(value, options, corta))
          })
        },
      },
    }
  )
}
