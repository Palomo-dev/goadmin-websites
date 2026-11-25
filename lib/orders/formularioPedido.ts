/**
 * Formulario del checkout configurado en el ERP (Parte F) visto por /api/orders: qué datos del
 * cliente faltan según la configuración de la organización. La regla es la COMPARTIDA con el ERP
 * (lib/website/formularioCheckout.ts → `faltantesPedido`); aquí solo se lee la fila.
 *
 * - Sin fila (`organization_settings` key `checkout_formulario`): `[]`, el servidor no revisa nada
 *   nuevo (lo de siempre).
 * - Con fila: los indispensables siempre (correo, nombre; dirección y municipio a domicilio) y el
 *   celular y las indicaciones si el ERP los volvió obligatorios.
 * - Si la lectura falla: `[]` y se registra. La red del servidor nunca bloquea una venta por un
 *   fallo de lectura: el checkout ya validó campo por campo.
 *
 * La organización es la del host (`contextOrgId` de la ruta), nunca la del body. Columnas
 * verificadas por MCP el 2026-11-25: organization_settings (organization_id, key, settings jsonb;
 * UNIQUE organization_id + key).
 */
import { CLAVE_FORMULARIO_CHECKOUT, faltantesPedido, leerFormularioCheckout, type ClaveCampoFormulario, type DatosPedidoFormulario } from '../website/formularioCheckout'

type ClienteLectura = {
  from: (tabla: string) => {
    select: (c: string) => {
      eq: (c: string, v: unknown) => {
        eq: (c: string, v: unknown) => { maybeSingle: () => PromiseLike<{ data: { settings?: unknown } | null; error: unknown }> }
      }
    }
  }
}

export async function faltantesFormularioPedido(
  supabase: ClienteLectura,
  organizationId: number,
  datos: DatosPedidoFormulario,
): Promise<ClaveCampoFormulario[]> {
  try {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('settings')
      .eq('organization_id', organizationId)
      .eq('key', CLAVE_FORMULARIO_CHECKOUT)
      .maybeSingle()
    if (error) {
      console.warn('[Orders] No se pudo leer el formulario del checkout; se sigue sin revisarlo', { organizationId })
      return []
    }
    return faltantesPedido(leerFormularioCheckout(data?.settings ?? null), datos)
  } catch {
    console.warn('[Orders] Falló la lectura del formulario del checkout; se sigue sin revisarlo', { organizationId })
    return []
  }
}

const NOMBRES: Record<ClaveCampoFormulario, string> = {
  email: 'correo',
  celular: 'celular',
  nombre: 'nombre',
  factura: 'factura',
  direccion: 'dirección',
  complemento: 'apto',
  ciudad: 'ciudad o municipio',
  barrio: 'barrio',
  notas: 'indicaciones',
}

/** «Faltan datos del pedido: correo y dirección.» */
export function mensajeFaltantes(faltan: readonly ClaveCampoFormulario[]): string {
  const nombres = faltan.map((k) => NOMBRES[k])
  const lista = nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  return `Faltan datos del pedido: ${lista}.`
}
