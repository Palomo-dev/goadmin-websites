import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { vincularClienteDeSesion } from '@/lib/auth/clienteSesion'
import { correoVerificado, destinoInterno } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

/**
 * GET /auth/callback?code=…&siguiente=/ruta — vuelta de Google (/api/auth/google).
 *
 * Canjea el código por la sesión (cookies de la tienda) y crea o vincula la ficha de cliente de la
 * organización del HOST con la misma ruta del código al correo (lib/auth/clienteSesion.ts). Google
 * entrega el correo verificado. Cualquier error vuelve a /auth con el aviso.
 */
export async function GET(request: NextRequest) {
  const origen = request.nextUrl.origin
  const code = request.nextUrl.searchParams.get('code')
  const siguiente = destinoInterno(request.nextUrl.searchParams.get('siguiente'))
  const orgId = await getOrgIdDelHost()
  if (!code || orgId === null) return NextResponse.redirect(new URL('/auth?error=google', origen))

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data?.user) {
    console.error('[google] No se pudo canjear el código', { orgId, error: error?.message })
    return NextResponse.redirect(new URL('/auth?error=google', origen))
  }
  const admin = createAdminClient()
  if (admin) await vincularClienteDeSesion(admin, orgId, data.user, { verificado: correoVerificado(data.user), autorizacionDatos: true })
  return NextResponse.redirect(new URL(siguiente, origen))
}
