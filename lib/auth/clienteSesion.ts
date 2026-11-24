/**
 * La ficha de cliente (`customers`) de la organización del HOST para un usuario de Supabase Auth.
 *
 * Una sola ruta para crear o vincular la ficha, la que ya hacían registrarse (/api/auth/register)
 * e ingresar (/api/auth/login), y ahora también el código al correo (/api/auth/codigo/verificar) y
 * Google (/auth/callback):
 * - Busca la ficha por correo en la organización (`unique_customer_email_per_org`). Si el correo se
 *   guardó con otras mayúsculas (los pedidos sin cuenta lo guardan como se escribió), la encuentra
 *   igual.
 * - Sin ficha: la crea con el correo (la cuenta se abre con él). Con ficha sin usuario (compró sin
 *   cuenta): la vincula; los pedidos ya apuntan a esa ficha (`web_orders.customer_id`), así que
 *   aparecen en Mis pedidos sin tocar `web_orders` (su trigger contable corre en cada UPDATE).
 * - Con ficha de otro usuario: solo se reasigna si el correo está verificado (`reasignar`).
 *
 * `organizationId` sale SIEMPRE del host (getOrgIdDelHost), nunca del body. El cliente es de
 * service role (RLS no aplica): cada consulta filtra por la organización.
 */
import { decisionVinculo } from '@/lib/cuenta/reglasCuenta'

type ClienteDb = { from: (tabla: string) => any }

export interface UsuarioSesion {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

export interface DatosFicha {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  /** Registrarse: los datos del formulario reemplazan los de la ficha (lo de siempre). */
  sobrescribir?: boolean
  /** El correo está verificado (código o confirmación): puede reasignar una ficha ajena. */
  verificado?: boolean
  /** Primera vez con el código: se anota cuándo aceptó el tratamiento de datos («Al continuar aceptas…»). */
  autorizacionDatos?: boolean
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Escapa `%`, `_` y `\` para un `ilike` que es igualdad sin distinguir mayúsculas. */
export function igualdadSinMayusculas(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Ficha de la organización con ese correo: exacta primero; si no, sin distinguir mayúsculas. */
export async function fichaPorCorreo(db: ClienteDb, organizationId: number, correo: string): Promise<{ id: string; user_id: string | null; is_registered: boolean | null; first_name: string | null; last_name: string | null; phone: string | null; preferences: unknown } | null> {
  const columnas = 'id, user_id, is_registered, first_name, last_name, phone, preferences'
  const { data: exacta } = await db.from('customers').select(columnas).eq('organization_id', organizationId).eq('email', correo).limit(1).maybeSingle()
  if (exacta) return exacta
  const { data: parecida } = await db
    .from('customers')
    .select(columnas)
    .eq('organization_id', organizationId)
    .ilike('email', igualdadSinMayusculas(correo))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return parecida ?? null
}

/** Devuelve el id de la ficha (creada o vinculada), o null si no se pudo. */
export async function vincularClienteDeSesion(
  db: ClienteDb,
  organizationId: number,
  user: UsuarioSesion,
  datos: DatosFicha = {},
): Promise<string | null> {
  const correo = texto(user.email)?.toLowerCase()
  if (!correo || !Number.isInteger(organizationId)) return null
  const meta = user.user_metadata ?? {}
  const nombre = texto(datos.firstName) ?? texto(meta.first_name)
  const apellido = texto(datos.lastName) ?? texto(meta.last_name)
  const telefono = texto(datos.phone) ?? texto(meta.phone)
  const ahora = new Date().toISOString()

  const ficha = await fichaPorCorreo(db, organizationId, correo)
  const decision = decisionVinculo(ficha, user.id)

  if (decision === 'crear') {
    const { data: nueva, error } = await db
      .from('customers')
      .insert({
        organization_id: organizationId,
        email: correo,
        // full_name, doc_type y doc_number son GENERATED ALWAYS: se escriben first_name/last_name.
        first_name: nombre ?? '',
        last_name: apellido ?? '',
        phone: telefono,
        user_id: user.id,
        is_registered: true,
        ...(datos.autorizacionDatos ? { preferences: { autorizacion_datos: { en: ahora, via: 'tienda' } } } : {}),
      })
      .select('id')
      .single()
    if (nueva?.id) return nueva.id as string
    // Carrera (dos pestañas): otra petición la creó entre la búsqueda y el insert.
    if (error) {
      const otra = await fichaPorCorreo(db, organizationId, correo)
      if (otra) return vincularExistente(db, organizationId, otra, user.id, { nombre, apellido, telefono, datos, ahora })
      console.error('[cuenta] No se pudo crear la ficha del cliente', { organizationId, error: error.message })
    }
    return null
  }

  if (decision === 'reasignar' && !datos.verificado) {
    // Correo sin verificar: la ficha sigue siendo de su usuario (como antes, que no se tocaba).
    return null
  }
  return vincularExistente(db, organizationId, ficha!, user.id, { nombre, apellido, telefono, datos, ahora })
}

async function vincularExistente(
  db: ClienteDb,
  organizationId: number,
  ficha: { id: string; user_id: string | null; is_registered: boolean | null; first_name: string | null; last_name: string | null; phone: string | null; preferences: unknown },
  userId: string,
  c: { nombre: string | null; apellido: string | null; telefono: string | null; datos: DatosFicha; ahora: string },
): Promise<string> {
  const cambios: Record<string, unknown> = {}
  if (ficha.user_id !== userId) cambios.user_id = userId
  if (!ficha.is_registered) cambios.is_registered = true
  // Registrarse reemplaza nombre y teléfono (lo de siempre); el código solo completa lo que falta.
  if (c.nombre && (c.datos.sobrescribir || !texto(ficha.first_name))) cambios.first_name = c.nombre
  if (c.apellido && (c.datos.sobrescribir || !texto(ficha.last_name))) cambios.last_name = c.apellido
  if (c.telefono && (c.datos.sobrescribir || !texto(ficha.phone))) cambios.phone = c.telefono
  if (c.datos.autorizacionDatos) {
    const pref = ficha.preferences && typeof ficha.preferences === 'object' ? (ficha.preferences as Record<string, unknown>) : {}
    if (!pref.autorizacion_datos) cambios.preferences = { ...pref, autorizacion_datos: { en: c.ahora, via: 'tienda' } }
  }
  if (Object.keys(cambios).length > 0) {
    cambios.updated_at = c.ahora
    const { error } = await db.from('customers').update(cambios).eq('id', ficha.id).eq('organization_id', organizationId)
    if (error) console.error('[cuenta] No se pudo vincular la ficha del cliente', { organizationId, error: error.message })
  }
  return ficha.id
}
