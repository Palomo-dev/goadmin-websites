import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  )
}

// Cliente para operaciones auth (login/register): usa service role key + escribe cookies en la respuesta
export async function createAuthClient() {
  const cookieStore = await cookies()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookies: {
        getAll() { return [] },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

/**
 * Devuelve la service role key o lanza. Las lecturas públicas del sitio
 * corren en el servidor con service role; caer en silencio a la anon key
 * rompería el sitio (RLS ya no abre esas tablas a anon) y ocultaría un
 * error de configuración del despliegue.
 */
function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY: las consultas públicas del sitio requieren el cliente de servidor.')
  }
  return key
}

// Cliente sin cookies para consultas públicas (solo servidor)
export function createPublicClient() {
  const key = requireServiceRoleKey()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
      // Sin esto, en un GET de route handler (aun con `force-dynamic`) Next 14 guarda cada
      // consulta en su Data Cache sin vencimiento: /api/locations/cities devolvía `[]` de
      // cuando la tabla estaba vacía. Lo que debe cachearse va con unstable_cache, que ya
      // corre sus consultas en no-store por dentro.
      global: { fetch: (u, o) => fetch(u, { ...o, cache: 'no-store' }) },
    }
  )
}

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return null

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}
