import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/get-org-context'
import { createAuthClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { destinoInterno, googleEnAcceso } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/google?siguiente=/ruta — «Continuar con Google» (Figma 2975:71911), opcional por tienda.
 *
 * Apagado mientras la tienda no tenga `header_cuenta.google === true` (el editor del ERP aún no
 * tiene el interruptor): sin él, vuelve a /auth. Para que funcione hace falta además el proveedor
 * Google activo en Supabase y `https://<dominio de la tienda>/auth/callback` en «Redirect URLs».
 * La organización sale del HOST; el destino solo puede ser una ruta del propio sitio.
 */
export async function GET(request: NextRequest) {
  const origen = request.nextUrl.origin
  const siguiente = destinoInterno(request.nextUrl.searchParams.get('siguiente'))
  if (!checkRateLimit(`google:ip:${getClientIP(request)}`, 20, 10 * 60 * 1000).allowed) {
    return NextResponse.redirect(new URL('/auth?error=google', origen))
  }
  const ctx = await getOrgContext()
  if (!ctx || !googleEnAcceso(ctx.effectiveSettings)) return NextResponse.redirect(new URL('/auth', origen))

  // PKCE: el verificador queda en una cookie de la tienda y /auth/callback lo canjea.
  const supabase = await createAuthClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origen}/auth/callback?siguiente=${encodeURIComponent(siguiente)}`,
      skipBrowserRedirect: true,
    },
  })
  if (error || !data?.url) {
    console.error('[google] No se pudo iniciar el ingreso con Google', { orgId: ctx.organization.id, error: error?.message })
    return NextResponse.redirect(new URL('/auth?error=google', origen))
  }
  return NextResponse.redirect(data.url)
}
