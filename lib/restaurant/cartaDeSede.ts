/**
 * Carta de la sede de una mesa en el sitio público (solo servidor).
 *
 * Extraído tal cual de `app/api/restaurant-tables/resolve/route.ts`: lo usa el resolve del QR
 * (`redirigir`) y puede usarlo cualquier otra ruta que mande una mesa a la carta de su sede, con
 * la MISMA regla (una sola implementación).
 */
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
