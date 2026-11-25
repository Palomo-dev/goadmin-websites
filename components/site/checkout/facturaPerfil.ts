/**
 * Prellenado de «Necesito factura a nombre de empresa» con lo que ya está en la cuenta (pedido del
 * dueño 2026-11-25: «no llenar dos veces el mismo dato»).
 *
 * - `facturaDePerfil` (servidor, /api/customer/me): de la ficha del cliente con sesión. Primero la
 *   empresa a la que pertenece (`parent_customer_id` con NIT: la que guardó una compra anterior con
 *   factura a nombre de empresa); si no, su propio documento (cédula, CE, pasaporte o NIT).
 * - `mezclarFacturaPerfil` (navegador, CheckoutWizard): llena SOLO lo vacío; lo que el cliente ya
 *   escribió no se toca, y la casilla no se marca sola (si la marca, los datos ya están).
 *
 * Puro: lo usan /api/customer/me, el checkout y scripts/verify-documento-pagador.mjs.
 */

import { documentoDePerfil } from '../../../lib/payments/documentoPagador'
import type { DatosFactura, TipoDocumentoFactura } from './facturaEmpresa'

export interface PerfilFactura {
  tipo: TipoDocumentoFactura
  numero: string
  dv: string
  razonSocial: string
  correo: string
}

/** Columnas de `customers` que se leen (todas existen: MCP 2026-11-25). */
export interface FichaFactura {
  identification_type?: string | null
  identification_number?: string | null
  dv?: number | string | null
  company_name?: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  billing_email?: string | null
}

function desdeFicha(ficha: FichaFactura | null | undefined): PerfilFactura | null {
  if (!ficha) return null
  const doc = documentoDePerfil(ficha.identification_type, ficha.identification_number)
  if (!doc) return null
  const nombre =
    (doc.tipo === 'NIT' ? (ficha.company_name || '').trim() : '') ||
    (ficha.full_name || '').trim() ||
    `${ficha.first_name || ''} ${ficha.last_name || ''}`.trim() ||
    (ficha.company_name || '').trim()
  const dv = ficha.dv === null || ficha.dv === undefined ? '' : String(ficha.dv).replace(/\D/g, '').slice(0, 1)
  return {
    tipo: doc.tipo,
    numero: doc.numero,
    dv: doc.tipo === 'NIT' ? dv : '',
    razonSocial: nombre,
    correo: (ficha.billing_email || '').trim() || (ficha.email || '').trim(),
  }
}

/** Datos de factura de la cuenta: la empresa (NIT) primero; si no, el documento del cliente. */
export function facturaDePerfil(cliente: FichaFactura | null | undefined, empresa?: FichaFactura | null): PerfilFactura | null {
  const deEmpresa = desdeFicha(empresa)
  if (deEmpresa && deEmpresa.tipo === 'NIT') return deEmpresa
  return desdeFicha(cliente)
}

const vacio = (v: unknown) => typeof v !== 'string' || v.trim() === ''

/**
 * Factura del checkout con lo de la cuenta, sin pisar lo escrito: el documento (tipo, número y DV
 * juntos) solo si el número está vacío; razón social y correo, cada uno solo si está vacío. La
 * casilla (`activa`) queda como estaba.
 */
export function mezclarFacturaPerfil(f: DatosFactura, perfil: PerfilFactura | null | undefined): DatosFactura {
  if (!perfil) return f
  const r: DatosFactura = { ...f }
  if (vacio(f.numero)) {
    r.tipo = perfil.tipo
    r.numero = perfil.numero
    r.dv = perfil.tipo === 'NIT' ? perfil.dv : ''
  } else {
    // Ya escribió un documento: se respeta (tipo, número y DV).
  }
  if (vacio(f.razonSocial) && perfil.razonSocial) r.razonSocial = perfil.razonSocial
  if (vacio(f.correo) && perfil.correo) r.correo = perfil.correo
  return r
}

/** `factura` de /api/customer/me ya leído en el navegador; null si no tiene la forma. */
export function leerPerfilFactura(valor: unknown): PerfilFactura | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const v = valor as Record<string, unknown>
  const tipo = v.tipo
  if (tipo !== 'NIT' && tipo !== 'CC' && tipo !== 'CE' && tipo !== 'PA') return null
  const s = (x: unknown) => (typeof x === 'string' ? x : '')
  if (!s(v.numero)) return null
  return { tipo, numero: s(v.numero), dv: s(v.dv), razonSocial: s(v.razonSocial), correo: s(v.correo) }
}
