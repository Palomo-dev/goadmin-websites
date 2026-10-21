import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cronAutorizado } from '@/lib/orders/cronAutorizado'
import { procesarColaCompraPendiente } from '@/lib/orders/procesarColaCompraPendiente'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Un correo por pedido, unas dos horas después de quedar cancelado o expirado.
 *
 * El mismo trabajo lo hace cada minuto `/api/revalidate/sitios-v2`, porque ese
 * cron es el que sí se ejecuta. Este horario de 15 minutos se conserva: si
 * llega a correr, el sello evita el segundo correo.
 *
 * Autenticación igual que `/api/revalidate/sitios-v2`: falla cerrado.
 * Vercel Cron llama con GET y `Authorization: Bearer`. La base llama con
 * el secreto del vault.
 */

async function procesar(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!supabase) {
    console.error('[carritos-abandonados] Sin SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }
  try {
    const resultado = await procesarColaCompraPendiente(supabase)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'No se pudo leer la cola'
    return NextResponse.json({ error: mensaje }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return procesar(request)
}

/** Vercel Cron invoca con GET. */
export async function GET(request: NextRequest) {
  return procesar(request)
}
