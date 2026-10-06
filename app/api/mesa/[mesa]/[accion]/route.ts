import { NextRequest, NextResponse } from 'next/server'
import {
  SIN_CACHE,
  contextoMesa,
  correoCliente,
  numeroCliente,
  respuestaRpc,
  textoCliente,
  type AccionMesa,
} from '@/lib/restaurant/mesa-servidor'
import { sanearComensal } from '@/lib/restaurant/mesa-modelo'

export const dynamic = 'force-dynamic'

/**
 * Carta QR en la mesa — rutas públicas por el QR de la mesa (Figma 2032:75742, lámina 20).
 *
 *   GET  /api/mesa/<mesa>/pedido               pedido de la sesión activa en rondas (en vivo)
 *   GET  /api/mesa/<mesa>/cuenta               cuenta: total, pagado, saldo, por comensal, abonos
 *   POST /api/mesa/<mesa>/solicitar            «Llamar al mesero» {motivo, detalle, comensal}
 *   POST /api/mesa/<mesa>/cancelar-solicitud   {solicitud}
 *   POST /api/mesa/<mesa>/pedir-cuenta         {detalle, comensal}
 *   POST /api/mesa/<mesa>/abono                {modo, partes, comensal, propina, monto, email, nombre}
 *   POST /api/mesa/<mesa>/valorar              {puntaje, aspectos, comentario, comensal, abono}
 *
 * `<mesa>` es el uuid del QR. La organización es la del host (lib/restaurant/mesa-servidor.ts),
 * nunca la del body; la base exige que la mesa sea suya y que tenga una sesión activa. Límite
 * por IP y por mesa en cada acción. Ninguna respuesta lleva datos personales.
 */

const LECTURAS: ReadonlySet<string> = new Set(['pedido', 'cuenta'])
const ESCRITURAS: ReadonlySet<string> = new Set(['solicitar', 'cancelar-solicitud', 'pedir-cuenta', 'abono', 'valorar'])

type Params = { params: Promise<{ mesa: string; accion: string }> }

function noEncontrada() {
  return NextResponse.json({ ok: false, motivo: 'NO_ENCONTRADA' }, { status: 404, headers: SIN_CACHE })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { mesa, accion } = await params
  if (!LECTURAS.has(accion)) return noEncontrada()
  const { searchParams } = new URL(request.url)
  const ctx = await contextoMesa(request, mesa, accion as AccionMesa, searchParams.get('organizationId'))
  if (!ctx.ok) return ctx.respuesta
  const rpc = accion === 'pedido' ? 'fn_mesa_pedido_publico' : 'fn_mesa_cuenta_publica'
  const { data, error } = await ctx.db.rpc(rpc, { p_organization_id: ctx.organizationId, p_table_id: ctx.mesaId })
  return respuestaRpc(accion as AccionMesa, ctx.organizationId, data, error)
}

export async function POST(request: NextRequest, { params }: Params) {
  const { mesa, accion } = await params
  if (!ESCRITURAS.has(accion)) return noEncontrada()
  let body: Record<string, unknown> = {}
  try {
    const leido = await request.json()
    body = leido && typeof leido === 'object' && !Array.isArray(leido) ? (leido as Record<string, unknown>) : {}
  } catch {
    body = {}
  }
  const orgCliente = body.organizationId === undefined || body.organizationId === null ? null : String(body.organizationId)
  const ctx = await contextoMesa(request, mesa, accion as AccionMesa, orgCliente)
  if (!ctx.ok) return ctx.respuesta
  const base = { p_organization_id: ctx.organizationId, p_table_id: ctx.mesaId }
  const comensal = sanearComensal(body.comensal)

  let rpc: string
  let args: Record<string, unknown>
  switch (accion) {
    case 'solicitar':
      rpc = 'fn_mesa_solicitar'
      args = { ...base, p_motivo: textoCliente(body.motivo, 80), p_detalle: textoCliente(body.detalle, 200), p_comensal: comensal }
      break
    case 'cancelar-solicitud': {
      const solicitud = typeof body.solicitud === 'string' && /^[0-9a-f-]{36}$/i.test(body.solicitud) ? body.solicitud : null
      if (!solicitud) return NextResponse.json({ ok: false, motivo: 'DATOS_INVALIDOS' }, { status: 400, headers: SIN_CACHE })
      rpc = 'fn_mesa_cancelar_solicitud'
      args = { ...base, p_request_id: solicitud }
      break
    }
    case 'pedir-cuenta':
      rpc = 'fn_mesa_pedir_cuenta'
      args = { ...base, p_detalle: textoCliente(body.detalle, 200), p_comensal: comensal }
      break
    case 'abono': {
      const modo = body.modo === 'iguales' || body.modo === 'comensal' ? body.modo : body.modo === 'todo' ? 'todo' : null
      const partes = numeroCliente(body.partes)
      const propina = numeroCliente(body.propina) ?? 0
      if (!modo || propina < 0 || (modo === 'iguales' && (partes === null || !Number.isInteger(partes)))) {
        return NextResponse.json({ ok: false, motivo: 'DATOS_INVALIDOS' }, { status: 400, headers: SIN_CACHE })
      }
      rpc = 'fn_mesa_abono_iniciar'
      args = {
        ...base,
        p_modo: modo,
        p_partes: modo === 'iguales' ? partes : null,
        p_comensal: comensal,
        p_propina: propina,
        p_monto_visto: numeroCliente(body.monto),
        p_email: correoCliente(body.email),
        p_nombre: textoCliente(body.nombre, 120),
      }
      break
    }
    case 'valorar': {
      const puntaje = numeroCliente(body.puntaje)
      if (puntaje === null || !Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) {
        return NextResponse.json({ ok: false, motivo: 'DATOS_INVALIDOS' }, { status: 400, headers: SIN_CACHE })
      }
      const aspectos = Array.isArray(body.aspectos)
        ? body.aspectos.map((a) => textoCliente(a, 60)).filter((a): a is string => a !== null).slice(0, 8)
        : null
      const abono = typeof body.abono === 'string' && /^[0-9a-f-]{36}$/i.test(body.abono) ? body.abono : null
      rpc = 'fn_mesa_valorar'
      args = {
        ...base,
        p_rating: puntaje,
        p_aspectos: aspectos,
        p_comentario: textoCliente(body.comentario, 1000),
        p_comensal: comensal,
        p_abono_id: abono,
      }
      break
    }
    default:
      return noEncontrada()
  }

  const { data, error } = await ctx.db.rpc(rpc, args)
  if (!error && data && typeof data === 'object' && (data as { ok?: unknown }).ok === false) {
    // Respuesta de negocio (SIN_SESION, PAGO_EN_CURSO, MONTO_CAMBIO…): 409 con el motivo.
    return NextResponse.json(data, { status: 409, headers: SIN_CACHE })
  } else {
    return respuestaRpc(accion as AccionMesa, ctx.organizationId, data, error)
  }
}
