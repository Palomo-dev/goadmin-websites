import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/memberships/freeze — DESACTIVADO (501) hasta que exista la solicitud en la base.
 *
 * Antes insertaba en `membership_freezes` con status `'pending'` como "solicitud" que el staff
 * aprobaba en el ERP. La base ya no admite ese estado (`membership_freezes.status` ∈
 * scheduled/active/ended/cancelled), así que el insert fallaba siempre. Además tomaba
 * `organizationId` y `customerId` del body.
 *
 * Por qué no se congela directamente con `fn_membresia_congelar`:
 *   - es una acción de staff: exige `fn_assert_acceso_org` + permiso `memberships.freeze`, y el
 *     cliente final no es miembro de la organización;
 *   - llamarla con service role se salta ese permiso (la función deja pasar a service role
 *     para cron y funciones internas) y convierte una "solicitud que el staff aprueba" en un
 *     congelamiento inmediato sin que el dueño lo haya decidido;
 *   - el ERP todavía no tiene dónde ver ni aprobar solicitudes.
 *
 * La propuesta de esquema (tabla de solicitudes + RPC solo para service role + aprobación en el
 * ERP) va en el informe del cambio; cuando exista, esta ruta la llamará con la organización del
 * contexto y el cliente de la sesión.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Por ahora la solicitud de congelamiento no está disponible en línea. Comunícate con el equipo para congelar tu membresía.',
      codigo: 'congelamiento_web_no_disponible',
    },
    { status: 501 }
  )
}
