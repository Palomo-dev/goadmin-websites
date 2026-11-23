/**
 * Cotización de domicilio por zona en el servidor de la tienda (logística Fase 1).
 *
 * Llama a `logistica_cotizar_envio` (ERP, migración 20261123145549) con el cliente de service role
 * y la organización del HOST (nunca la del body). El checkout la usa para mostrar «Domicilio» y
 * /api/orders para cobrar: el valor que manda el navegador se ignora.
 *
 * Dirección: el checkout guarda país, departamento (`state_code`) y ciudad escrita; el código DANE
 * se busca en `municipalities` (mismo país, mismo departamento, mismo nombre sin tildes). El barrio
 * y el código postal van tal cual; la base los normaliza.
 */
import { direccionParaCotizar, itemsParaCotizar, leerCotizacion, type CotizacionEnvio, type ItemCotizacion } from './cotizacionLogistica'

type ClienteSupabase = { from: (tabla: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any }

export interface DireccionCheckout {
  ciudad?: string | null
  /** ISO-3 del país del checkout (`COL`). */
  pais?: string | null
  /** Código del departamento (`11`, `05`). */
  departamento?: string | null
  barrio?: string | null
  codigoPostal?: string | null
}

/** Minúsculas, sin tildes ni signos; «Bogotá, D.C.» → «bogota». */
export function normalizarMunicipio(nombre: string | null | undefined): string {
  return (nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\b(d c|dc|distrito capital)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** El código del único municipio del departamento con ese nombre; null si no hay o hay dos. */
export function codigoDeMunicipio(ciudad: string | null | undefined, municipios: readonly { code: string; name: string }[]): string | null {
  const buscado = normalizarMunicipio(ciudad)
  if (!buscado) return null
  const iguales = municipios.filter((m) => normalizarMunicipio(m.name) === buscado)
  return iguales.length === 1 ? iguales[0].code : null
}

export async function municipioDane(supabase: ClienteSupabase, d: DireccionCheckout): Promise<string | null> {
  const pais = (d.pais || '').trim().toUpperCase()
  const departamento = (d.departamento || '').trim()
  if (pais !== 'COL' || !departamento || !(d.ciudad || '').trim()) return null
  const { data, error } = await supabase
    .from('municipalities')
    .select('code, name')
    .eq('country_code', pais)
    .eq('state_code', departamento)
  if (error || !Array.isArray(data)) return null
  return codigoDeMunicipio(d.ciudad, data)
}

/** Opciones de la RPC: método de pago y los productos (la base suma su peso). Vacío = como antes. */
export function opcionesCotizacion(
  metodoPago: string | null | undefined,
  items: ReadonlyArray<{ product_id?: unknown; cantidad?: unknown }> | null | undefined,
): { metodo_pago?: string; items?: ItemCotizacion[] } {
  const out: { metodo_pago?: string; items?: ItemCotizacion[] } = {}
  if (metodoPago) out.metodo_pago = metodoPago
  const lista = itemsParaCotizar(items)
  if (lista.length > 0) out.items = lista
  return out
}

/**
 * Cotiza el domicilio propio. Devuelve null si la RPC falla (el llamador sigue con el cálculo de
 * siempre): nunca se cobra un envío inventado.
 */
export async function cotizarDomicilioWeb(
  supabase: ClienteSupabase,
  e: {
    organizationId: number
    branchId: number | null
    direccion: DireccionCheckout
    subtotal: number
    metodoPago?: string | null
    /** Productos del pedido: la base suma su peso para las reglas de despacho por peso. */
    items?: ReadonlyArray<{ product_id?: unknown; cantidad?: unknown }>
  },
): Promise<CotizacionEnvio | null> {
  try {
    const dane = await municipioDane(supabase, e.direccion)
    const { data, error } = await supabase.rpc('logistica_cotizar_envio', {
      p_organization_id: e.organizationId,
      p_branch_id: e.branchId,
      p_direccion: direccionParaCotizar({ municipio_dane: dane, barrio: e.direccion.barrio ?? null, codigo_postal: e.direccion.codigoPostal ?? null }),
      p_canal: 'web',
      p_subtotal: Math.max(Number(e.subtotal) || 0, 0),
      p_opciones: opcionesCotizacion(e.metodoPago, e.items),
    })
    if (error) {
      console.error('[Envío] La cotización por zona falló', { organizationId: e.organizationId, message: error.message })
      return null
    }
    return leerCotizacion(data)
  } catch (err) {
    console.error('[Envío] La cotización por zona lanzó', { organizationId: e.organizationId, err: err instanceof Error ? err.message : err })
    return null
  }
}
