/**
 * ¿Qué conexión de Bold firmó este evento? La que tiene la llave secreta con la que la firma
 * `x-bold-signature` cuadra (forma documentada: HMAC-SHA256 del cuerpo en Base64).
 *
 * La organización de un evento de Bold sale de AQUÍ, nunca del cuerpo ni de la referencia: el
 * número de pedido no es único entre tiendas y cualquiera puede escribir un JSON.
 */
import { valorDeCredencial } from '@/lib/payments/secretosConexion'
import { firmaBoldValida } from '@/lib/payments/pasarelasTienda'

/** `integration_connectors`: Bold — Link de pago / Botón (`bold_link`) y Bold — Datáfono / QR (`bold_pos`). */
export const BOLD_CONECTOR_LINK_ID = '6d732ae3-e9ff-41be-9d75-aa29ba86d927'
export const BOLD_CONECTOR_POS_ID = '5ddaf08b-cd11-41b8-b772-350ca176239a'

export interface FirmanteBold {
  organizationId: number
  connectionId: string
}

export async function firmanteBold(
  supabase: any,
  cuerpo: Uint8Array,
  firma: string | null | undefined,
): Promise<FirmanteBold | null> {
  if (!firma) return null

  const { data: conexiones, error } = await supabase
    .from('integration_connections')
    .select('id, organization_id, connector_id')
    .in('connector_id', [BOLD_CONECTOR_LINK_ID, BOLD_CONECTOR_POS_ID])
    .in('status', ['active', 'connected'])
  if (error || !Array.isArray(conexiones) || conexiones.length === 0) return null

  const { data: llaves } = await supabase
    .from('integration_credentials')
    .select('connection_id, purpose, secret_ref')
    .in('connection_id', conexiones.map((c: any) => c.id))
    .eq('purpose', 'secret_key')
    .eq('status', 'active')
  const porConexion = new Map<string, string>()
  for (const fila of llaves ?? []) {
    if (fila?.secret_ref && !porConexion.has(fila.connection_id)) porConexion.set(fila.connection_id, fila.secret_ref)
  }

  // Primero las del botón de pagos (la tienda), luego las del datáfono.
  const ordenadas = [...conexiones].sort(
    (a: any, b: any) => Number(b.connector_id === BOLD_CONECTOR_LINK_ID) - Number(a.connector_id === BOLD_CONECTOR_LINK_ID)
  )
  for (const conexion of ordenadas) {
    const guardada = porConexion.get(conexion.id)
    if (!guardada) continue
    const llave = await valorDeCredencial(supabase, conexion.id, 'secret_key', guardada)
    if (llave && firmaBoldValida(cuerpo, firma, llave)) {
      return { organizationId: Number(conexion.organization_id), connectionId: String(conexion.id) }
    }
  }
  return null
}
