/**
 * Contrato de errores de las RPC de reserva de mesa (migraciones D1/D2 del
 * ERP, `supabase/pendientes/20261007100100_reservas_reglas_servidor.sql`).
 *
 * `create_restaurant_reservation` y `cancel_restaurant_reservation` lanzan
 * mensajes con prefijo (`FUERA_DE_HORARIO: …`, `AFORO: …`). Aquí se traducen a
 * HTTP y a un texto legible para el cliente. Puro: lo usan las rutas y
 * cualquier otro paquete que muestre esos errores.
 *
 * Antes de aplicar D1 la RPC lanza los mensajes viejos (sin prefijo): quien
 * llama conserva su mapeo anterior en el `else`.
 */

export type CodigoReglaReserva =
  | 'FUERA_DE_HORARIO'
  | 'ANTICIPACION'
  | 'AFORO'
  | 'ZONA'
  | 'CONTACTO'
  | 'PERSONAS'
  | 'DESHABILITADA'
  | 'PASADA'

const CODIGOS: readonly CodigoReglaReserva[] = [
  'FUERA_DE_HORARIO',
  'ANTICIPACION',
  'AFORO',
  'ZONA',
  'CONTACTO',
  'PERSONAS',
  'DESHABILITADA',
  'PASADA',
]

export interface ReglaIncumplida {
  codigo: CodigoReglaReserva
  /** Texto de la base después del prefijo (sin tildes: viene de SQL). */
  detalle: string
}

/** `{ codigo, detalle }` si el mensaje trae un prefijo conocido; si no, `null`. */
export function reglaDeError(mensaje: string | null | undefined): ReglaIncumplida | null {
  const m = /^([A-Z_]+):\s*([\s\S]*)$/.exec((mensaje ?? '').trim())
  if (!m) return null
  const codigo = m[1] as CodigoReglaReserva
  return CODIGOS.includes(codigo) ? { codigo, detalle: m[2].trim() } : null
}

const MENSAJES: Record<CodigoReglaReserva, { status: number; mensaje: string }> = {
  FUERA_DE_HORARIO: { status: 400, mensaje: 'Esa hora está fuera del horario de reservas de la sede. Elige otra hora.' },
  ANTICIPACION: { status: 400, mensaje: 'Esa fecha u hora no cumple la anticipación que pide la sede.' },
  AFORO: { status: 409, mensaje: 'No hay mesas disponibles para la fecha y hora seleccionadas' },
  ZONA: { status: 400, mensaje: 'La zona elegida no admite reservas. Elige otra zona.' },
  CONTACTO: { status: 400, mensaje: 'Falta un dato de contacto obligatorio.' },
  PERSONAS: { status: 400, mensaje: 'El número de personas no está permitido en esta sede.' },
  DESHABILITADA: { status: 403, mensaje: 'Las reservas en línea no están disponibles en esta sede.' },
  PASADA: { status: 422, mensaje: 'La hora de la reserva ya pasó: escribe al restaurante para cualquier cambio.' },
}

/** Detalles de la base que sí conviene mostrar tal cual (con tildes). */
function detalleLegible(regla: ReglaIncumplida): string | null {
  const d = regla.detalle
  let m = /minimo de personas es (\d+)/i.exec(d)
  if (m) return `El número mínimo de personas es ${m[1]}.`
  m = /maximo de personas es (\d+)/i.exec(d)
  if (m) return `El número máximo de personas es ${m[1]}.`
  if (/celular es obligatorio/i.test(d)) return 'El celular es obligatorio.'
  if (/correo es obligatorio/i.test(d)) return 'El correo es obligatorio.'
  m = /hasta (\d+) dias/i.exec(d)
  if (m) return `Solo se reserva con hasta ${m[1]} días de anticipación.`
  m = /al menos (\d+) minutos/i.exec(d)
  if (m) return `Reserva con al menos ${m[1]} minutos de anticipación.`
  m = /menos de (\d+) horas/i.exec(d)
  if (m) return `No se puede cancelar con menos de ${m[1]} horas de anticipación.`
  return null
}

export function respuestaDeRegla(regla: ReglaIncumplida): { status: number; mensaje: string } {
  const base = MENSAJES[regla.codigo]
  return { status: base.status, mensaje: detalleLegible(regla) ?? base.mensaje }
}

/** Ruta de la página de gestión por token (la enlazan el correo, la confirmación y el recordatorio del ERP). */
export function rutaGestionReserva(token: string): string {
  return `/reserva/mesa/${encodeURIComponent(token)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function tokenValido(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor)
}
