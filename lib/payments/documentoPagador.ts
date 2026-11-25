/**
 * Documento del pagador para las pasarelas (pedido del dueño 2026-11-25: «que la cédula o el NIT
 * del checkout le aparezca a la pasarela para no llenar dos veces el mismo dato»).
 *
 * Puro (sin red ni base): lo usan `/api/checkout/init` (vía `documentoPagadorServidor.ts`) y
 * `scripts/verify-documento-pagador.mjs`.
 *
 * Solo por los campos OFICIALES de cada pasarela (documentación revisada el 2026-11-25):
 * - Wompi Web Checkout: `customer-data:legal-id` + `customer-data:legal-id-type`
 *   (CC, CE, NIT, PP, TI, DNI, RG, OTHER). docs.wompi.co › Widget & Checkout Web.
 * - Mercado Pago (preferencia, servidor → servidor): `payer.identification { type, number }`;
 *   Colombia admite CC, CE, NIT y «Otro» (/v1/identification_types). El pasaporte NO tiene tipo
 *   propio: no se envía.
 * - Bold (botón de pagos): `customerData.documentNumber` + `customerData.documentType`
 *   (CC, CE, PA, NIT, TI). developers.bold.co › Botón de pagos › Integración manual.
 * - PayU WebCheckout: `payerDocument` / `payerDocumentType` y `buyerDocument` /
 *   `buyerDocumentType`; la documentación solo da ejemplos (CC, NIT…), así que se envían CC, CE y
 *   NIT; el pasaporte no.
 * - Stripe y PayPal: no tienen campo para un documento colombiano: no se envía.
 *
 * El NIT viaja SIN el dígito de verificación (solo dígitos): ninguna de las cuatro tiene un campo
 * para el DV y todas validan el número del NIT solo.
 *
 * Privacidad: el documento nunca va en una URL de la tienda ni en un log. Wompi y PayU lo reciben
 * en la URL de SU formulario (es el único campo oficial de su checkout web); Mercado Pago, en la
 * llamada servidor → servidor; Bold, en la configuración de su botón que arma el navegador (nunca en
 * `/checkout/bold?…`).
 */

/** Tipos del checkout (components/site/checkout/facturaEmpresa.ts). */
export type TipoDocumentoPagador = 'NIT' | 'CC' | 'CE' | 'PA'

export interface DocumentoPagador {
  tipo: TipoDocumentoPagador
  /** NIT y cédula: solo dígitos (NIT sin DV). CE y pasaporte: letras, números y guion. */
  numero: string
}

export type PasarelaConDocumento = 'wompi_co' | 'mp_checkout' | 'bold_link' | 'payu_co' | 'stripe_payments' | 'paypal_checkout'

/** Tipo que acepta cada pasarela por cada tipo del checkout; `null` = no lo admite (no se envía). */
export const TIPOS_POR_PASARELA: Record<PasarelaConDocumento, Record<TipoDocumentoPagador, string | null>> = {
  wompi_co: { CC: 'CC', CE: 'CE', NIT: 'NIT', PA: 'PP' },
  mp_checkout: { CC: 'CC', CE: 'CE', NIT: 'NIT', PA: null },
  bold_link: { CC: 'CC', CE: 'CE', NIT: 'NIT', PA: 'PA' },
  payu_co: { CC: 'CC', CE: 'CE', NIT: 'NIT', PA: null },
  stripe_payments: { CC: null, CE: null, NIT: null, PA: null },
  paypal_checkout: { CC: null, CE: null, NIT: null, PA: null },
}

const TIPOS: readonly TipoDocumentoPagador[] = ['NIT', 'CC', 'CE', 'PA']

/** Normaliza un número por tipo; null si no tiene la forma que valida el checkout. */
export function normalizarNumero(tipo: TipoDocumentoPagador, valor: unknown): string | null {
  const crudo = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : ''
  if (tipo === 'NIT' || tipo === 'CC') {
    const d = crudo.replace(/\D/g, '')
    if (tipo === 'NIT' && (d.length < 6 || d.length > 15)) return null
    if (tipo === 'CC' && (d.length < 3 || d.length > 10)) return null
    return d
  }
  const t = crudo.replace(/\s/g, '').toUpperCase()
  return /^[A-Z0-9-]{3,20}$/.test(t) ? t : null
}

/** El documento de `web_orders.billing_data` (lo que el comprador escribió en el checkout). */
export function documentoDeFacturaPedido(billing: unknown): DocumentoPagador | null {
  if (!billing || typeof billing !== 'object' || Array.isArray(billing)) return null
  const b = billing as Record<string, unknown>
  const tipo = typeof b.tipo === 'string' ? (b.tipo.toUpperCase() as TipoDocumentoPagador) : null
  if (!tipo || !TIPOS.includes(tipo)) return null
  const numero = normalizarNumero(tipo, b.numero)
  return numero ? { tipo, numero } : null
}

/**
 * Códigos de `customers.identification_type` (los de `country_identification_types` del ERP, en
 * minúscula, más variantes viejas) → tipo del checkout. Los demás (TI, PEP, NUIP…) no se envían:
 * no están en el checkout y no todas las pasarelas los admiten.
 */
const TIPO_PERFIL: Record<string, TipoDocumentoPagador> = {
  cc: 'CC', nit: 'NIT', rut: 'NIT', ce: 'CE', passport: 'PA', pasaporte: 'PA', pa: 'PA', pp: 'PA',
}

/** El documento de la ficha del cliente (con sesión). null si no hay o el tipo no aplica. */
export function documentoDePerfil(tipo: unknown, numero: unknown): DocumentoPagador | null {
  const t = typeof tipo === 'string' ? TIPO_PERFIL[tipo.trim().toLowerCase()] : undefined
  if (!t) return null
  const n = normalizarNumero(t, numero)
  return n ? { tipo: t, numero: n } : null
}

/** Tipo y número para una pasarela, o null si esa pasarela no admite ese tipo (no se envía). */
export function documentoParaPasarela(pasarela: string, doc: DocumentoPagador | null | undefined): { tipo: string; numero: string } | null {
  if (!doc) return null
  const tabla = (TIPOS_POR_PASARELA as Record<string, Record<TipoDocumentoPagador, string | null>>)[pasarela]
  const tipo = tabla ? tabla[doc.tipo] : null
  return tipo ? { tipo, numero: doc.numero } : null
}

/**
 * `customerData` de Bold con el documento, a partir del que ya va en la URL de `/checkout/bold`
 * (correo, nombre y celular). null si Bold no admite el tipo o no hay documento: el navegador usa
 * el de la URL, como hoy. El resultado va SOLO en la respuesta de `/api/checkout/init`, nunca en
 * la URL.
 */
export function customerDataBoldConDocumento(customerDataUrl: string | null | undefined, doc: DocumentoPagador | null | undefined): string | null {
  const d = documentoParaPasarela('bold_link', doc)
  if (!d) return null
  let base: Record<string, unknown> = {}
  try {
    const leido = customerDataUrl ? JSON.parse(customerDataUrl) : {}
    if (leido && typeof leido === 'object' && !Array.isArray(leido)) base = leido as Record<string, unknown>
  } catch {
    // customerData ilegible: solo el documento.
  }
  return JSON.stringify({ ...base, documentNumber: d.numero, documentType: d.tipo })
}

/**
 * Qué documento se puede mandar a la pasarela de un pedido web:
 * 1. El de la factura del pedido (`billing_data`), si quien paga demostró ser el comprador: el
 *    token de seguimiento del pedido o la sesión del cliente del pedido.
 * 2. Sin factura pedida: el de la ficha del cliente, SOLO con la sesión de ese mismo cliente (un
 *    invitado puede haber escrito el correo de otra persona; su token no le da el documento de esa
 *    ficha).
 * 3. Ninguno: null (la pasarela lo pide, como hoy).
 */
export function elegirDocumentoPagador(opciones: {
  billing: unknown
  perfil: { tipo: unknown; numero: unknown } | null
  tokenValido: boolean
  sesionEsDelPedido: boolean
}): DocumentoPagador | null {
  const autorizado = opciones.tokenValido || opciones.sesionEsDelPedido
  if (!autorizado) return null
  const deFactura = documentoDeFacturaPedido(opciones.billing)
  if (deFactura) return deFactura
  if (opciones.sesionEsDelPedido && opciones.perfil) return documentoDePerfil(opciones.perfil.tipo, opciones.perfil.numero)
  return null
}
