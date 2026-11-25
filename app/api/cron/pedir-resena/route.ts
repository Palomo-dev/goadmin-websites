import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cronAutorizado } from '@/lib/orders/cronAutorizado'
import { otroProyecto } from '@/lib/orders/proyectoCola'
import { procesarPedirResenas } from '@/lib/resenas/procesarPedirResenas'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Correo «¿Qué te pareció tu compra?» (Figma 3A): una vez al día, pg_cron `pedir-resena-sitio`
 * → `fn_websites_cron_post('/api/cron/pedir-resena')` (no va en `vercel.json`), como
 * `/api/cron/recordatorio-pago`. Autenticación: `CRON_SECRET` o el secreto del vault; falla cerrado.
 * Reglas en `lib/resenas/pedirResena.ts`; corrida en `lib/resenas/procesarPedirResenas.ts`.
 */
async function procesar(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!supabase) {
    console.error('[pedir-resena] Sin SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }
  if (otroProyecto()) return NextResponse.json({ ok: true, omitido: 'otro_proyecto' })
  try {
    return NextResponse.json({ ok: true, ...(await procesarPedirResenas(supabase)) })
  } catch (err) {
    console.error('[pedir-resena] Error en la corrida', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'No se pudo procesar' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return procesar(request)
}

export async function GET(request: NextRequest) {
  return procesar(request)
}
