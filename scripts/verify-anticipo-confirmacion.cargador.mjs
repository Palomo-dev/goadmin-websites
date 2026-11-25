/**
 * Cargador de `verify-anticipo-confirmacion.mjs` (no lo uses suelto). Va encadenado DESPUÉS del de
 * verify-pasarelas-bold-mp (transpila .ts, alias @/ y efectos del ERP) y solo cambia por un módulo
 * de registro los correos del anticipo (pagado y tardío) y `next/headers` (lo importa el cliente de servidor, que aquí
 * nunca se llama: la base es simulada).
 */
let STUB = ''

export async function initialize(data) {
  STUB = data.stub
}

export async function resolve(specifier, context, next) {
  if (specifier === 'next/headers') return { url: STUB, shortCircuit: true }
  if ((specifier === './correoAnticipo' || specifier === './correoAnticipoTardio') && (context.parentURL || '').includes('/lib/contraentrega/')) {
    return { url: STUB, shortCircuit: true }
  }
  return next(specifier, context)
}
