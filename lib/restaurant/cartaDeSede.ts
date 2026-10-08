/**
 * Carta de la sede de una mesa en el sitio público (solo servidor).
 *
 * Una sola regla para mandar una mesa a la carta de su sede: la usan el resolve del QR
 * (`/api/restaurant-tables/resolve`, campo `redirigir`) y la página `/menu?mesa=` del sitio
 * principal (`cartaDeLaSedeDeLaMesa`), que así ya no depende de que el navegador cargue la carta
 * del principal para luego saltar.
 */
import { createAdminClient } from '@/lib/supabase/server'
import { resolverSedeCarta } from '@/lib/products/carta-sede'
import { buscarMesaDeOrganizacion } from '@/lib/orders/mesaPedido'
import { getSedesWeb } from '@/lib/restaurant/sedes'

/**
 * Carta de una sede publicada con la mesa del QR: dominio propio → `https://<dominio>/menu?mesa=`;
 * si no, `/<slug>/menu?mesa=` bajo el sitio principal (el mismo `href` del selector de sedes,
 * lib/outlet/sedeLayout.ts). `null` si la sede no tiene sitio publicado.
 */
export async function cartaDeSede(organizationId: number, branchId: number, mesaId: string): Promise<string | null> {
  const sede = (await getSedesWeb(organizationId)).find((s) => s.id === branchId)
  if (!sede) return null
  const base = sede.customDomain
    ? `https://${sede.customDomain}`
    : sede.slug
      ? `/${encodeURIComponent(sede.slug)}`
      : null
  return base === null ? null : `${base}/menu?mesa=${encodeURIComponent(mesaId)}`
}

/**
 * QR impreso leído en el sitio PRINCIPAL (`<host>/menu?mesa=<ref>`, sin sede en la ruta ni en el
 * host): la sede la decide la MESA, no el dominio. Devuelve la carta de la sede de la mesa
 * (`cartaDeSede`: `/<slug>/menu?mesa=…` o su dominio propio) si la mesa es de una sede distinta
 * de la de la carta del principal y esa sede tiene sitio publicado. Allí la página `/menu` busca
 * su «Carta QR» con la sede ya resuelta, y el pedido y la cuenta son de esa sede.
 *
 * La mesa se valida contra la organización del HOST (`organizationId` sale de `getOrgContext`,
 * nunca de la query) con la misma búsqueda que `/api/orders` (`buscarMesaDeOrganizacion`).
 *
 * `null` (la página sigue como hoy) si: la organización no tiene ninguna sede servida aparte (p. ej.
 * una sola sede: ni una consulta más, la lista de sedes ya está cacheada), la mesa no existe o es
 * de la sede de la carta del principal, la sede de la mesa no tiene sitio, o falla la lectura.
 */
export async function cartaDeLaSedeDeLaMesa(organizationId: number, ref: string): Promise<string | null> {
  const sedes = await getSedesWeb(organizationId)
  if (!sedes.some((s) => !s.esPrincipal && (s.customDomain || s.slug))) {
    // Ninguna sede con sitio aparte: el QR se queda en el principal, como siempre.
    return null
  }
  const supabase = createAdminClient()
  if (!supabase) {
    console.error('[Mesa QR] Falta SUPABASE_SERVICE_ROLE_KEY: el QR sigue en el sitio principal')
    return null
  }
  const sedeCarta = await resolverSedeCarta(organizationId, null)
  const resultado = await buscarMesaDeOrganizacion(supabase as any, organizationId, ref, sedeCarta)
  const mesa = resultado.ok ? resultado.mesa : resultado.motivo === 'otra_sede' ? resultado.mesa : null
  if (mesa && mesa.branch_id !== sedeCarta) {
    return cartaDeSede(organizationId, mesa.branch_id, mesa.id)
  } else {
    // Mesa de la sede de la carta del principal, o inexistente: como hoy.
    return null
  }
}
