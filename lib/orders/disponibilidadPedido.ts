/**
 * ¿Se puede aceptar este pedido ahora? Regla pura que `/api/orders` aplica antes de leer precios y
 * de crear nada.
 *
 * 1. Pedido en línea apagado (`website_settings.enable_online_ordering === false`) en un
 *    restaurante → 403 PEDIDO_EN_LINEA_APAGADO. Solo restaurante: en las demás verticales esa
 *    columna nunca se usó para vender y vale `false` por defecto (verificado por MCP el
 *    2026-10-06: de las organizaciones con pedidos web en 60 días, el único restaurante la tiene
 *    en `true`).
 * 2. Sede con horario (restaurante): «lo antes posible» con la sede cerrada → 422 SEDE_CERRADA;
 *    hora programada inválida, pasada, fuera de horario o lejana → 422 HORA_PROGRAMADA_INVALIDA.
 * 3. Sin fila de ajustes, sin horario o no restaurante: se acepta, exactamente como antes.
 */

import { validarMomentoPedido, type CodigoMomento } from '@/lib/restaurant/ventanaPedido'
import type { HorarioSemana } from '@/lib/restaurant/horario'

export interface EntradaDisponibilidad {
  esRestaurante: boolean
  /** `website_settings.enable_online_ordering`; `null` si no hay fila. */
  pedidoEnLinea: boolean | null
  horario: HorarioSemana | null
  zona: string
  /** Hora programada del cliente; `null` = lo antes posible. */
  programadoPara: string | null
  ahora?: Date
}

export type Disponibilidad =
  | { ok: true; programadoPara: string | null }
  | {
      ok: false
      status: 403 | 422
      code: 'PEDIDO_EN_LINEA_APAGADO' | CodigoMomento
      error: string
      proximaApertura: string | null
    }

export function evaluarDisponibilidadPedido(e: EntradaDisponibilidad): Disponibilidad {
  if (e.esRestaurante && e.pedidoEnLinea === false) {
    return {
      ok: false,
      status: 403,
      code: 'PEDIDO_EN_LINEA_APAGADO',
      error: 'Este restaurante no está recibiendo pedidos en línea en este momento.',
      proximaApertura: null,
    }
  }
  if (e.esRestaurante && e.horario) {
    const momento = validarMomentoPedido(e.horario, e.zona, e.programadoPara, e.ahora ?? new Date())
    if (!momento.ok) {
      return { ok: false, status: 422, code: momento.code, error: momento.mensaje, proximaApertura: momento.proximaApertura }
    }
    return { ok: true, programadoPara: momento.programadoPara }
  }
  // No restaurante o sede sin horario: comportamiento anterior (se acepta la hora del cliente si
  // parsea; si no, se ignora como antes no se validaba).
  const t = e.programadoPara ? new Date(e.programadoPara) : null
  return { ok: true, programadoPara: t && !Number.isNaN(t.getTime()) ? t.toISOString() : null }
}

/**
 * Interruptor de despliegue del horario de la sede (servidor): `ORDERS_ENFORCE_BRANCH_HOURS=true`
 * rechaza con 422 y el checkout muestra las franjas de la sede; en cualquier otro valor (por
 * defecto) /api/orders solo REGISTRA lo que habría rechazado y el checkout sigue como antes.
 *
 * Por qué no va activo de entrada (MCP 2026-10-06): el único restaurante con pedidos web en 60
 * días (org 120) tiene en su sede el horario por defecto del formulario del ERP (09:00–18:00) y
 * sus 3 pedidos entraron a las 19:59, 20:10 y 23:21: todos habrían sido rechazados. Se activa
 * cuando las sedes tengan su horario real (detección de horario por defecto: paquete C) y los
 * registros de observación no muestren rechazos legítimos.
 */
export function horarioSedeObligatorio(): boolean {
  return process.env.ORDERS_ENFORCE_BRANCH_HOURS === 'true'
}
