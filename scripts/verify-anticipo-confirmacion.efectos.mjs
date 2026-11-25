/** Correo del anticipo y `next/headers` falsos para `verify-anticipo-confirmacion.mjs`: registra la llamada y nada más. */
export const enviarCorreoAnticipoPagado = async (...args) => {
  ;(globalThis.__efectosPago ??= []).push({ nombre: 'correoAnticipoPagado', args })
}
export const enviarCorreoAnticipoPendiente = async () => {}
export const enviarCorreoAnticipoTardio = async (...args) => {
  ;(globalThis.__efectosPago ??= []).push({ nombre: 'correoAnticipoTardio', args })
}
export const cookies = () => ({ get: () => undefined, getAll: () => [], set: () => {} })
export const headers = () => new Map()
