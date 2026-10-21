import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cronAutorizado } from '@/lib/orders/cronAutorizado'
import { ErrorReclamoCola, procesarColaCompraPendiente } from '@/lib/orders/procesarColaCompraPendiente'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Un correo por pedido, unas dos horas después de quedar cancelado o expirado.
 *
 * Lo llama pg_cron cada 15 minutos, al proyecto que tiene la clave de
 * servicio. El otro proyecto de Vercel comparte el repositorio y no debe
 * reclamar la cola. El cron de cada minuto solo vacía la bandeja de
 * publicación.
 *
 * Autenticación igual que `/api/revalidate/sitios-v2`: falla cerrado.
 * La base llama con el secreto del vault.
 */

/** Proyecto `goadmin-websites` (alias 8fs1). El otro proyecto no envía. */
const PROYECTO_COLA_COMPRA_PENDIENTE = 'prj_VJXk9thDpwIrOGzc6K6SHTKROlhL'

function otroProyecto(): boolean {
  const id = process.env.VERCEL_PROJECT_ID
  return !!id && id !== PROYECTO_COLA_COMPRA_PENDIENTE
}

async function procesar(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!supabase) {
    console.error('[carritos-abandonados] Sin SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }
  if (otroProyecto()) {
    return NextResponse.json({ ok: true, omitido: 'otro_proyecto' })
  }
  try {
    const resultado = await procesarColaCompraPendiente(supabase)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    if (err instanceof ErrorReclamoCola) {
      console.error('[carritos-abandonados] No se pudo reclamar la cola', {
        sqlstate: err.sqlstate,
        mensajePostgres: err.mensajePostgres,
      })
      return NextResponse.json(
        { error: err.message, sqlstate: err.sqlstate, mensaje: err.mensajePostgres },
        { status: 500 },
      )
    }
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
