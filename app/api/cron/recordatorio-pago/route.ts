import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cronAutorizado } from '@/lib/orders/cronAutorizado'
import { otroProyecto } from '@/lib/orders/proyectoCola'
import { ErrorLecturaRecordatorios, procesarRecordatoriosPago } from '@/lib/orders/procesarRecordatoriosPago'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Correo «Termina tu pago»: un recordatorio por pedido del sitio con pasarela que sigue sin
 * pagar, a los 10 minutos (o a la mitad de un plazo corto) y antes de que venza.
 * Reglas en `lib/orders/recordatorioPago.ts`; corrida en `lib/orders/procesarRecordatoriosPago.ts`.
 *
 * Lo llama la base cada 5 minutos (pg_cron `recordatorio-pago-sitio` → `fn_websites_cron_post`, como la compra pendiente; no va en `vercel.json`). Autenticación igual que
 * `/api/cron/carritos-abandonados`: `CRON_SECRET` o el secreto del vault; falla cerrado.
 * El otro proyecto de Vercel comparte el `vercel.json` y no envía; si no se puede saber qué
 * proyecto es, el reclamo en `web_order_email_log` evita el doble envío.
 */
async function procesar(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!supabase) {
    console.error('[recordatorio-pago] Sin SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }
  if (otroProyecto()) {
    return NextResponse.json({ ok: true, omitido: 'otro_proyecto' })
  }
  try {
    const resultado = await procesarRecordatoriosPago(supabase)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    if (err instanceof ErrorLecturaRecordatorios) {
      return NextResponse.json({ error: err.message, mensaje: err.mensajePostgres }, { status: 500 })
    }
    console.error('[recordatorio-pago] Error en la corrida', { err })
    return NextResponse.json({ error: 'No se pudo procesar' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return procesar(request)
}

/** Vercel Cron invoca con GET. */
export async function GET(request: NextRequest) {
  return procesar(request)
}
