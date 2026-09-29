/**
 * Correo de «Membresía activada» para membresías compradas en un pedido web.
 *
 * La membresía la crea/activa el ERP al confirmar el pedido pagado (`/api/web-orders/[id]/
 * auto-confirm` → `fn_membresias_activar_venta`) y la devuelve en la respuesta como
 * `membresias: [{ id, plan, plan_id, product_id, estado, desde, hasta, codigo, customer_id }]`.
 * El ERP solo la devuelve cuando ESA llamada creó la venta (`creada=true`); una repetición
 * (webhook + página de resultado, reintento de la pasarela) no trae `membresias`, así que el
 * correo sale una sola vez.
 *
 * La organización sale del pedido (buscado por id con service role), nunca de un payload.
 * Nunca lanza: el pedido y la membresía ya existen; un fallo aquí solo deja el correo sin enviar.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { sendMembershipConfirmationEmail } from '@/lib/email/send-membership-confirmation'

interface MembresiaActivadaErp {
  id: number
  plan: string | null
  plan_id: number | null
  product_id: number | null
  estado: string
  desde: string | null
  hasta: string
  codigo: string | null
  customer_id: string | null
}

const UNIDADES: Record<string, [string, string]> = {
  day: ['día', 'días'],
  week: ['semana', 'semanas'],
  month: ['mes', 'meses'],
  year: ['año', 'años'],
}

function leerMembresias(valor: unknown): MembresiaActivadaErp[] {
  if (!Array.isArray(valor)) return []
  return valor.filter(
    (m): m is MembresiaActivadaErp =>
      !!m && typeof m === 'object' && typeof (m as any).id === 'number' && typeof (m as any).hasta === 'string'
  )
}

function urlPortal(org: { custom_domain?: string | null; subdomain?: string | null }): string {
  if (org.custom_domain) return `https://${org.custom_domain}/mi-cuenta/membresia`
  if (org.subdomain) return `https://${org.subdomain}.goadmin.io/mi-cuenta/membresia`
  return ''
}

export async function enviarConfirmacionMembresiasPedidoWeb(webOrderId: string, membresiasErp: unknown): Promise<void> {
  try {
    // Solo las que quedaron activas: una `pending` (plan que exige activación en el primer
    // check-in) no está «activada» todavía.
    const activas = leerMembresias(membresiasErp).filter((m) => m.estado === 'active')
    if (activas.length === 0) return

    const supabase = createAdminClient()
    if (!supabase) {
      console.error('[MembresiasPedidoWeb] Falta SUPABASE_SERVICE_ROLE_KEY: correo de membresía sin enviar', { webOrderId })
      return
    }
    const sb = supabase as any

    const { data: pedido, error: pedidoError } = await sb
      .from('web_orders')
      .select('id, organization_id, customer_email, customer_name')
      .eq('id', webOrderId)
      .maybeSingle()
    if (pedidoError || !pedido?.customer_email) {
      if (pedidoError) console.error('[MembresiasPedidoWeb] Error leyendo el pedido:', pedidoError)
      return
    }

    const [{ data: org }, { data: lineas }, { data: planes }] = await Promise.all([
      sb.from('organizations')
        .select('name, subdomain, custom_domain, timezone')
        .eq('id', pedido.organization_id)
        .maybeSingle(),
      sb.from('web_order_items')
        .select('product_id, total')
        .eq('web_order_id', pedido.id),
      sb.from('membership_plans')
        .select('id, duration_unit, duration_value, duration_days')
        .eq('organization_id', pedido.organization_id)
        .in('id', activas.map((m) => m.plan_id).filter((id): id is number => typeof id === 'number')),
    ])

    for (const m of activas) {
      const plan = ((planes || []) as any[]).find((p) => p.id === m.plan_id)
      const unidad = plan?.duration_unit ? UNIDADES[plan.duration_unit] : undefined
      const valor = plan?.duration_value ?? null
      const periodo = unidad && valor ? `${valor} ${valor === 1 ? unidad[0] : unidad[1]}` : plan?.duration_days ? `${plan.duration_days} días` : ''
      const pagado = ((lineas || []) as any[])
        .filter((l) => l.product_id === m.product_id)
        .reduce((suma, l) => suma + Number(l.total || 0), 0)

      await sendMembershipConfirmationEmail({
        membershipId: m.id,
        customerEmail: pedido.customer_email,
        customerName: pedido.customer_name || 'Miembro',
        planName: m.plan || 'Membresía',
        planPrice: pagado,
        startDate: m.desde || new Date().toISOString(),
        endDate: m.hasta,
        accessCode: m.codigo || '',
        frequency: periodo,
        organizationName: org?.name || '',
        portalUrl: org ? urlPortal(org) : '',
        timeZone: org?.timezone || 'America/Bogota',
      })
    }
  } catch (err) {
    console.error('[MembresiasPedidoWeb] Error enviando la confirmación de membresía:', { webOrderId, err })
  }
}
