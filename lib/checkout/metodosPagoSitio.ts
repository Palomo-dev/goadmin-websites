/**
 * Medios de pago del sitio web: los de `organization_payment_methods` visibles en el sitio y las
 * pasarelas conectadas que no tienen fila propia. Extraído tal cual de app/checkout/page.tsx
 * (checkout de 83 sitios: extracción primero, cambios en un commit aparte). Lo usan el checkout y
 * la consulta del pedido («Pagar con otro medio»).
 */

import { esColumnaAusente } from '@/lib/payments/metodosPorSucursal'
import { usoTienda } from '@/lib/payments/usoPasarela'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export async function getWebsitePaymentMethods(organizationId: number) {
  const supabase = createAdminClient() || createPublicClient()

  // 1. Métodos de pago nativos (cash, transfer, card, etc.) habilitados para website
  // `branch_ids` (métodos por sucursal, ERP 20261028180000) solo si la columna ya existe.
  const leer = (extra: string) => (supabase as any)
    .from('organization_payment_methods')
    .select(`
      id, payment_method_code, is_active, show_on_website,
      website_display_order, website_display_name, website_description, website_icon,
      integration_connection_id,
      payment_methods (name, requires_reference)${extra}
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('show_on_website', true)
    .order('website_display_order', { ascending: true, nullsFirst: false })
  // `website_usage` («Usar en la tienda para», ERP 20261126120000): si la columna aún no existe,
  // se lee como antes y todas las pasarelas quedan en `ambos` (lo de siempre).
  let { data: orgMethods, error: orgError } = await leer(', branch_ids, website_usage')
  if (orgError && esColumnaAusente(orgError, 'website_usage')) {
    ({ data: orgMethods, error: orgError } = await leer(', branch_ids'))
  } else {
    // Con la columna (o con otro error, que sigue su camino de siempre).
  }
  if (orgError && esColumnaAusente(orgError, 'branch_ids')) {
    ({ data: orgMethods, error: orgError } = await leer(''))
  }

  const methods = (orgMethods || []).map((m: any) => ({
    code: m.payment_method_code,
    name: m.website_display_name || m.payment_methods?.name || m.payment_method_code,
    description: m.website_description || null,
    icon: m.website_icon || null,
    requiresReference: m.payment_methods?.requires_reference || false,
    connectionId: m.integration_connection_id || null,
    type: m.integration_connection_id ? 'gateway' as const : 'native' as const,
    branchIds: Array.isArray(m.branch_ids) && m.branch_ids.length > 0 ? (m.branch_ids as number[]) : null,
    uso: usoTienda(m.website_usage),
  }))

  // 2. Pasarelas de pago online (integration_connections activas/conectadas)
  // Solo agregar las que NO ya están en organization_payment_methods
  const existingConnectionIds = new Set(methods.filter((m: any) => m.connectionId).map((m: any) => m.connectionId))

  const { data: gateways } = await (supabase as any)
    .from('integration_connections')
    .select(`
      id, environment, status,
      integration_connectors!inner (code, name)
    `)
    .eq('organization_id', organizationId)
    .in('status', ['active', 'connected'])
    .in('integration_connectors.code', [
      'wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout', 'bold_link'
    ])

  const gatewayMethods = (gateways || [])
    .filter((conn: any) => !existingConnectionIds.has(conn.id))
    .map((conn: any) => ({
      code: conn.integration_connectors.code,
      name: conn.integration_connectors.name,
      description: null,
      icon: null,
      requiresReference: false,
      connectionId: conn.id,
      type: 'gateway' as const,
      // Sin fila propia no hay uso guardado: pago completo y anticipo, como siempre.
      uso: usoTienda(null),
    }))

  return [...methods, ...gatewayMethods]
}
