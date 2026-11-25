/**
 * Tiempo de entrega del checkout: UNA regla para la tarjeta «Domicilio» / «Transportadora», el
 * aviso «Domicilio a Medellín: $ 20.000» y la fila de envío del resumen (celular y computador).
 *
 * De dónde sale, en este orden (lo primero que la tienda haya configurado):
 * 1. Zona de domicilio propio (cotización de /api/shipping/quote): `llegadaZona`. Con zona, la
 *    zona decide sola (si no reparte en esa dirección, no hay tiempo).
 * 2. Días estimados de las tarifas web de Transporte (`shipping_rates.estimated_transit_days`).
 * 3. Tiempos de «Pedidos online» del ERP (Configuración › Punto de venta › Pedidos online:
 *    `organization_settings` con clave `pedidos_online_tiempos`), por sede y por tipo de entrega.
 *    Solo lo que la tienda GUARDÓ: nunca los valores de fábrica del ERP (1 día + 5 días).
 * 4. Nada: no se inventa un tiempo.
 *
 * `shipping_flat_rate_description` nace con el DEFAULT de la columna «Entrega en 3-5 días hábiles»
 * (MCP 2026-11-25: las 46 filas lo tienen y el ERP no lo edita): ese texto NO es un tiempo que la
 * tienda haya configurado y no se muestra. Un texto propio se sigue mostrando como hoy.
 *
 * Puro: checkout (components/site/CheckoutWizard.tsx), app/checkout/page.tsx y
 * scripts/verify-tiempo-entrega.mjs.
 */

import type { GrupoEnvio } from './opcionesDomicilio'

/** DEFAULT de `website_settings.shipping_flat_rate_description` (MCP 2026-11-25). */
export const DESCRIPCION_ENVIO_POR_DEFECTO = 'Entrega en 3-5 días hábiles'

/** Clave de la fila de `organization_settings` (la misma del ERP, `tiemposPedidos.ts`). */
export const CLAVE_TIEMPOS_PEDIDOS = 'pedidos_online_tiempos'

/**
 * Descripción de la tarifa plana que sí puso la tienda, o null. El DEFAULT de la columna (o vacío)
 * es null: no es un tiempo configurado. Cualquier otro texto, tal cual (lo de hoy).
 */
export function descripcionEnvioPropia(descripcion: string | null | undefined): string | null {
  const t = typeof descripcion === 'string' ? descripcion.trim() : ''
  if (!t) return null
  if (t.toLowerCase() === DESCRIPCION_ENVIO_POR_DEFECTO.toLowerCase()) return null
  return t
}

export type UnidadTiempo = 'minutos' | 'horas' | 'dias'

export interface TiempoConfigurado {
  valor: number
  unidad: UnidadTiempo
}

export type TipoTiempoEntrega = 'domicilio' | 'transportadora'

export interface TiemposDeTipo {
  alistar?: TiempoConfigurado
  entrega?: TiempoConfigurado
}

export type TiemposPorTipo = Partial<Record<TipoTiempoEntrega, TiemposDeTipo>>

/** Lo guardado en «Pedidos online» (sin «Recoger»: aquí solo cuenta lo que se envía). */
export interface TiemposEntregaTienda {
  general: TiemposPorTipo
  porSede: Record<string, TiemposPorTipo>
}

const TIPOS: readonly TipoTiempoEntrega[] = ['domicilio', 'transportadora']
const VALOR_MAXIMO = 999

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Un tiempo válido (misma lectura tolerante que el ERP: «30», `minutes`, `días`…) o null. */
function leerTiempo(raw: unknown, minimo: number): TiempoConfigurado | null {
  if (!esObjeto(raw)) return null
  const n = typeof raw.valor === 'string' && raw.valor.trim() !== '' ? Number(raw.valor) : raw.valor
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const valor = Math.round(n)
  if (valor < minimo || valor > VALOR_MAXIMO) return null
  const u = typeof raw.unidad === 'string' ? raw.unidad.trim().toLowerCase() : ''
  const unidad = ({ minutos: 'minutos', minutes: 'minutos', horas: 'horas', hours: 'horas', dias: 'dias', días: 'dias', days: 'dias' } as Record<string, UnidadTiempo>)[u]
  return unidad ? { valor, unidad } : null
}

function leerPorTipo(raw: unknown): TiemposPorTipo {
  const salida: TiemposPorTipo = {}
  if (!esObjeto(raw)) return salida
  for (const tipo of TIPOS) {
    const t = raw[tipo]
    if (!esObjeto(t)) continue
    const alistar = leerTiempo(t.alistar, 1)
    const entrega = leerTiempo(t.entrega, 0)
    if (alistar || entrega) salida[tipo] = { ...(alistar ? { alistar } : {}), ...(entrega ? { entrega } : {}) }
  }
  return salida
}

/** `organization_settings.settings` → lo que se envía, o null si no hay nada guardado. */
export function leerTiemposEntregaTienda(raw: unknown): TiemposEntregaTienda | null {
  if (!esObjeto(raw)) return null
  const general = leerPorTipo(raw.por_tipo)
  const porSede: Record<string, TiemposPorTipo> = {}
  if (esObjeto(raw.por_sede)) {
    for (const [clave, valor] of Object.entries(raw.por_sede)) {
      if (!/^[1-9]\d{0,9}$/.test(clave)) continue
      const t = leerPorTipo(valor)
      if (Object.keys(t).length > 0) porSede[clave] = t
    }
  }
  if (Object.keys(general).length === 0 && Object.keys(porSede).length === 0) return null
  return { general, porSede }
}

const MINUTOS: Record<UnidadTiempo, number> = { minutos: 1, horas: 60, dias: 24 * 60 }

/** «45 min», «1 hora», «3 horas», «1 día», «14 días» (redondea hacia arriba: nunca promete antes). */
export function duracionLegible(minutos: number): string | null {
  if (!Number.isFinite(minutos) || minutos <= 0) return null
  if (minutos >= MINUTOS.dias) {
    const d = Math.ceil(minutos / MINUTOS.dias)
    return d === 1 ? '1 día' : `${d} días`
  }
  if (minutos >= 60) {
    const h = Math.ceil(minutos / 60)
    return h === 1 ? '1 hora' : `${h} horas`
  }
  return `${Math.round(minutos)} min`
}

/**
 * «Llega en aprox. 14 días» con lo guardado en «Pedidos online»: alistar + entrega (la misma suma
 * que la «Entrega aprox.» del ERP al confirmar). Sede → general, campo por campo, como el ERP.
 * Sin tiempo de entrega guardado, null (no se usa el de fábrica).
 */
export function tiempoConfiguradoTexto(
  tiempos: TiemposEntregaTienda | null | undefined,
  grupo: GrupoEnvio,
  sedeId?: number | null,
): string | null {
  if (!tiempos) return null
  const tipo: TipoTiempoEntrega = grupo === 'third_party' ? 'transportadora' : 'domicilio'
  const sede = sedeId !== null && sedeId !== undefined ? tiempos.porSede[String(sedeId)]?.[tipo] : undefined
  const general = tiempos.general[tipo]
  const entrega = sede?.entrega ?? general?.entrega
  if (!entrega) return null
  const alistar = sede?.alistar ?? general?.alistar
  const total = entrega.valor * MINUTOS[entrega.unidad] + (alistar ? alistar.valor * MINUTOS[alistar.unidad] : 0)
  const texto = duracionLegible(total)
  return texto ? `Llega en aprox. ${texto}` : null
}

export interface FuentesTiempoEntrega {
  /** La tienda tiene zonas y hay cotización: la zona decide sola. */
  conZona: boolean
  /** `llegadaZona(...)` si la zona reparte; null si no. */
  zona: string | null
  /** `textoDias` de las tarifas web del grupo (null sin días). */
  tarifas: string | null
  /** `tiempoConfiguradoTexto(...)`. */
  configurado: string | null
}

/** EL tiempo que muestran la tarjeta, el aviso y el resumen. Sin nada configurado, null. */
export function tiempoEntregaCheckout(f: FuentesTiempoEntrega): string | null {
  if (f.conZona) return f.zona
  return f.tarifas ?? f.configurado ?? null
}
