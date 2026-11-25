/**
 * «Necesito factura a nombre de empresa» del checkout v2 (Figma «16 Sitio web» › Checkout v2,
 * A1b 3138-92776 y pieza 3138-92577; aprobado por el dueño el 2026-11-24).
 *
 * Casilla opcional en Contacto: tipo de documento (NIT, Cédula, Cédula de extranjería, Pasaporte),
 * número (con DV si es NIT), razón social o nombre y correo para la factura electrónica.
 *
 * DÓNDE SE GUARDA (verificado por MCP el 2026-11-24, proyecto taqjemqjtumhwptchcxk): `web_orders` no
 * tiene `metadata` ni columnas de facturación. Sin columnas nuevas (regla del dueño), los datos
 * viajan en `customer_notes` (las notas del pedido que ya llegan al ERP) con una línea propia y
 * legible: «[Factura electrónica] NIT 900.123.456-7 · Distribuidora S.A.S. · factura@empresa.com».
 * La fase 2 (configuración del formulario desde el ERP) decide si pasa a una columna.
 *
 * Puro (sin React ni imports): lo usan el checkout y `scripts/verify-checkout-v2.mjs`.
 */

export type TipoDocumentoFactura = 'NIT' | 'CC' | 'CE' | 'PA'

export const TIPOS_DOCUMENTO_FACTURA: readonly { codigo: TipoDocumentoFactura; etiqueta: string; etiquetaNumero: string }[] = [
  { codigo: 'NIT', etiqueta: 'NIT', etiquetaNumero: 'Número de NIT' },
  { codigo: 'CC', etiqueta: 'Cédula', etiquetaNumero: 'Número de cédula' },
  { codigo: 'CE', etiqueta: 'Cédula de extranjería', etiquetaNumero: 'Número de cédula de extranjería' },
  { codigo: 'PA', etiqueta: 'Pasaporte', etiquetaNumero: 'Número de pasaporte' },
]

export interface DatosFactura {
  activa: boolean
  tipo: TipoDocumentoFactura
  numero: string
  dv: string
  razonSocial: string
  correo: string
}

export const FACTURA_VACIA: DatosFactura = { activa: false, tipo: 'NIT', numero: '', dv: '', razonSocial: '', correo: '' }

/** Pesos de la DIAN para el dígito de verificación, del dígito de la derecha hacia la izquierda. */
const PESOS_DV = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

/** Solo los dígitos («900.123.456» → «900123456»). */
export function soloDigitos(valor: string): string {
  return (valor || '').replace(/\D/g, '')
}

/** Dígito de verificación del NIT (algoritmo de la DIAN). null si el NIT no tiene dígitos o es muy largo. */
export function calcularDV(nit: string): number | null {
  const d = soloDigitos(nit)
  if (d.length === 0 || d.length > PESOS_DV.length) return null
  let suma = 0
  for (let i = 0; i < d.length; i++) suma += Number(d[d.length - 1 - i]) * PESOS_DV[i]
  const r = suma % 11
  return r > 1 ? 11 - r : r
}

/** «900123456» → «900.123.456». */
export function formatearMiles(digitos: string): string {
  return soloDigitos(digitos).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** ¿Tiene forma de correo? (la misma regla que el correo del cliente). */
export function correoValido(valor: string): boolean {
  return CORREO.test((valor || '').trim())
}

export type CampoFactura = 'factura_numero' | 'factura_dv' | 'factura_razon' | 'factura_correo'

/**
 * Errores de la factura, por campo, con un mensaje que dice qué hacer. Casilla sin marcar: ninguno
 * (la factura sale a nombre del cliente como consumidor final, como hoy).
 */
export function erroresFactura(f: DatosFactura): Partial<Record<CampoFactura, string>> {
  if (!f.activa) return {}
  const e: Partial<Record<CampoFactura, string>> = {}
  const numero = f.tipo === 'NIT' || f.tipo === 'CC' ? soloDigitos(f.numero) : (f.numero || '').trim()
  if (!numero) {
    e.factura_numero = f.tipo === 'NIT' ? 'Escribe el NIT, sin puntos ni guion.' : 'Escribe el número del documento.'
  } else if (f.tipo === 'NIT' && (numero.length < 6 || numero.length > 15)) {
    e.factura_numero = 'El NIT tiene entre 6 y 15 dígitos, sin el DV.'
  } else if (f.tipo === 'CC' && (numero.length < 3 || numero.length > 10)) {
    e.factura_numero = 'La cédula tiene entre 3 y 10 dígitos.'
  } else if ((f.tipo === 'CE' || f.tipo === 'PA') && !/^[A-Za-z0-9-]{3,20}$/.test(numero)) {
    e.factura_numero = 'Usa solo letras y números (de 3 a 20).'
  }
  if (f.tipo === 'NIT' && !e.factura_numero) {
    // Solo bloquea un DV vacío o que no es un número. Uno distinto al calculado se AVISA
    // (`avisoDV`) pero deja seguir: el RUT del cliente manda (prueba en vivo, 2026-11-24).
    if (soloDigitos(f.dv).length !== 1) e.factura_dv = 'Escribe el dígito de verificación (DV) del RUT.'
  }
  if (!(f.razonSocial || '').trim()) {
    e.factura_razon = f.tipo === 'NIT' ? 'Escribe la razón social, como aparece en el RUT.' : 'Escribe el nombre para la factura.'
  }
  if (!correoValido(f.correo)) e.factura_correo = 'Escribe el correo donde llega la factura. Ejemplo: factura@empresa.com'
  return e
}

/** Dígitos desde los que el DV se llena solo (los NIT de empresa tienen 9). */
export const DIGITOS_NIT_DV_AUTOMATICO = 9

/**
 * DV que queda al cambiar el número del NIT. Con 9 dígitos o más se llena con el calculado, salvo
 * que el cliente ya haya escrito uno propio (distinto al calculado para el número anterior): ese se
 * respeta. Si el número baja de 9 dígitos, el DV automático se borra; el propio se respeta.
 */
export function dvAlCambiarNumero(f: Pick<DatosFactura, 'tipo' | 'numero' | 'dv'>, numeroNuevo: string): string {
  if (f.tipo !== 'NIT') return f.dv
  const anterior = calcularDV(f.numero)
  const dvActual = soloDigitos(f.dv)
  const eraAutomatico = dvActual === '' || (anterior !== null && dvActual === String(anterior))
  if (!eraAutomatico) return f.dv
  const nuevo = soloDigitos(numeroNuevo)
  if (nuevo.length < DIGITOS_NIT_DV_AUTOMATICO) return ''
  const calculado = calcularDV(nuevo)
  return calculado === null ? '' : String(calculado)
}

/** Aviso (no bloquea) si el DV escrito no es el que da el cálculo de la DIAN para ese NIT. */
export function avisoDV(f: Pick<DatosFactura, 'activa' | 'tipo' | 'numero' | 'dv'>): string | null {
  if (!f.activa || f.tipo !== 'NIT') return null
  const dv = soloDigitos(f.dv)
  const esperado = calcularDV(f.numero)
  if (dv.length !== 1 || esperado === null || soloDigitos(f.numero).length < 6) return null
  return Number(dv) === esperado ? null : `Para ese NIT el DV suele ser ${esperado}. Revísalo en el RUT; si el tuyo es otro, puedes seguir.`
}

/** «NIT 900.123.456-7», «Cédula 1.020.304.050», «Pasaporte AB12345». */
export function documentoFactura(f: Pick<DatosFactura, 'tipo' | 'numero' | 'dv'>): string {
  if (f.tipo === 'NIT') return `NIT ${formatearMiles(f.numero)}${soloDigitos(f.dv) ? `-${soloDigitos(f.dv)}` : ''}`
  if (f.tipo === 'CC') return `Cédula ${formatearMiles(f.numero)}`
  const etiqueta = TIPOS_DOCUMENTO_FACTURA.find((t) => t.codigo === f.tipo)?.etiqueta ?? 'Documento'
  return `${etiqueta} ${(f.numero || '').trim()}`
}

export const MARCA_FACTURA = '[Factura electrónica]'

/** Línea que va a las notas del pedido. null con la casilla sin marcar. */
export function lineaFacturaNotas(f: DatosFactura): string | null {
  if (!f.activa) return null
  return `${MARCA_FACTURA} ${documentoFactura(f)} · ${(f.razonSocial || '').trim()} · ${(f.correo || '').trim()}`
}

/**
 * Notas del pedido con la factura: las del cliente y, en otra línea, la de la factura. Sin factura,
 * las notas tal cual (lo de hoy). Una línea de factura vieja que ya estuviera en las notas se
 * reemplaza, nunca se repite.
 */
export function notasConFactura(notas: string, f: DatosFactura): string {
  const propias = (notas || '')
    .split('\n')
    .filter((l) => !l.startsWith(MARCA_FACTURA))
    .join('\n')
    .trim()
  const linea = lineaFacturaNotas(f)
  if (!linea) return notas
  return propias ? `${propias}\n${linea}` : linea
}
