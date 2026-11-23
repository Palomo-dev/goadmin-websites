/**
 * «Domicilio» con zonas de domicilio (logística Fase 1, Figma «21 Logística» 2830:75378 con zona y
 * 2830:75453 fuera de zona). Puro: checkout, /api/orders y scripts/verify-zonas-envio.mjs.
 *
 * El precio NO se calcula aquí: lo da `logistica_cotizar_envio` en el servidor
 * (cotizacionLogistica.ts es la copia del contrato del ERP). Aquí solo se decide:
 * - si la tienda usa zonas (sin zonas configuradas todo queda como antes: tarifa plana o
 *   shipping_rates);
 * - qué cobra el pedido y si se puede pedir a domicilio (fuera de cobertura o bajo el mínimo, no);
 * - qué dice la tarjeta «Domicilio» y la barra «Te faltan $X para envío gratis».
 */
import { promesaEntrega, type CotizacionEnvio, type UnidadPromesa } from './cotizacionLogistica'

/**
 * Lo único de la cotización que sale al navegador (/api/shipping/quote → checkout): precio, zona
 * por su nombre, promesa (tiempo y día de despacho), envío gratis, pedido mínimo y motivo. No
 * salen ids de zona ni de regla, cómo coincidió la dirección, hora de corte, días de reparto,
 * modo ni la tarifa antes del envío gratis (2026-11-23).
 */
export interface CotizacionPublica {
  en_zona: boolean
  /** `id` solo existe del lado del servidor (CotizacionEnvio); al navegador no sale. */
  zona: { id?: string; nombre: string; es_tarifa_general: boolean } | null
  precio: number | null
  moneda: string | null
  envio_gratis: boolean
  envio_gratis_desde: number | null
  falta_para_envio_gratis: number | null
  pedido_minimo: number
  cumple_minimo: boolean
  falta_para_minimo: number
  tiempo: { min_minutos: number | null; max_minutos: number | null; texto: string | null } | null
  despacho: { fecha: string; hoy: boolean } | null
  motivo: CotizacionEnvio['motivo']
  alternativa: CotizacionEnvio['alternativa']
}

/** La cotización del servidor recortada a lo que necesita el checkout (ver CotizacionPublica). */
export function cotizacionPublica(c: CotizacionEnvio): CotizacionPublica {
  return {
    en_zona: c.en_zona,
    zona: c.zona ? { nombre: c.zona.nombre, es_tarifa_general: !!c.zona.es_tarifa_general } : null,
    precio: c.precio,
    moneda: c.moneda ?? null,
    envio_gratis: c.envio_gratis,
    envio_gratis_desde: c.envio_gratis_desde,
    falta_para_envio_gratis: c.falta_para_envio_gratis,
    pedido_minimo: c.pedido_minimo,
    cumple_minimo: c.cumple_minimo,
    falta_para_minimo: c.falta_para_minimo,
    tiempo: c.tiempo
      ? { min_minutos: c.tiempo.min_minutos ?? null, max_minutos: c.tiempo.max_minutos ?? null, texto: c.tiempo.texto ?? null }
      : null,
    despacho: c.despacho ? { fecha: c.despacho.fecha, hoy: !!c.despacho.hoy } : null,
    motivo: c.motivo ?? null,
    alternativa: c.alternativa ?? null,
  }
}

/** ¿La organización tiene zonas? Sin cotización (error) se trata como sin zonas: se cobra como antes. */
export function usaZonas(c: CotizacionEnvio | null | undefined): c is CotizacionEnvio {
  return !!c && c.motivo !== 'sin_zonas_configuradas'
}

export type BloqueoDomicilio = 'FUERA_DE_COBERTURA' | 'PEDIDO_MINIMO_DOMICILIO'

export type EnvioZona =
  | { ok: true; costo: number; zonaId: string | null; zonaNombre: string | null; fueraDeZona: boolean }
  | { ok: false; codigo: BloqueoDomicilio }

/**
 * Lo que cobra un pedido a domicilio propio con zonas. En zona: el precio de la zona (0 si aplica
 * envío gratis). Fuera de zona con tarifa general: esa tarifa. Fuera de cobertura (solo
 * transportadora o nada) o bajo el pedido mínimo: no se puede pedir a domicilio.
 */
export function envioDeZona(c: CotizacionPublica): EnvioZona {
  if (c.precio === null) return { ok: false, codigo: 'FUERA_DE_COBERTURA' }
  if (!c.cumple_minimo) return { ok: false, codigo: 'PEDIDO_MINIMO_DOMICILIO' }
  const fuera = !c.en_zona || !!c.zona?.es_tarifa_general
  return {
    ok: true,
    costo: Math.max(0, Number(c.precio) || 0),
    zonaId: c.zona?.id ?? null,
    zonaNombre: fuera ? null : c.zona?.nombre ?? null,
    fueraDeZona: fuera,
  }
}

const UNIDADES: Record<UnidadPromesa, [string, string]> = {
  minutos: ['min', 'min'],
  horas: ['hora', 'horas'],
  dias: ['día', 'días'],
}

/**
 * «45–60 min», «2–4 horas», «3–15 días», «hasta 15 días» o el texto de la zona («Mismo día»).
 * La unidad sale del contrato (`promesaEntrega`): un envío nacional no se muestra en minutos.
 */
export function tiempoZona(c: Pick<CotizacionPublica, 'tiempo'>): string | null {
  const p = promesaEntrega(c.tiempo)
  if (!p) return null
  if (p.texto) return p.texto
  if (p.hasta === null) return null
  const [uno, varios] = UNIDADES[p.unidad]
  const palabra = (n: number) => (n === 1 ? uno : varios)
  if (p.desde === null) return `${p.unidad === 'minutos' ? '' : 'hasta '}${p.hasta} ${palabra(p.hasta)}`
  if (p.desde === p.hasta) return `${p.hasta} ${palabra(p.hasta)}`
  return `${p.desde}–${p.hasta} ${palabra(p.hasta)}`
}

/**
 * Qué dice la tarjeta «Domicilio» sobre cuándo llega. `fechaCorta` formatea el `date` sin convertir zona.
 * - Domicilio del mismo día (minutos u horas): «Llega hoy · 45–60 min» o «Sale el lun 24 nov · 45–60 min».
 * - Envío de días (nacional) o con texto propio: «Sale hoy · llega en 3–15 días»,
 *   «Sale el lun 24 nov · llega en máximo 15 días» o «Sale hoy · 2 a 5 días hábiles».
 * «Llega hoy» solo se promete cuando la entrega cabe en el día (2026-11-23).
 */
export function llegadaZona(c: CotizacionPublica, fechaCorta: (fecha: string) => string): string | null {
  const tiempo = tiempoZona(c)
  const d = c.despacho
  if (!d) return tiempo
  const p = promesaEntrega(c.tiempo)
  const sale = d.hoy ? 'Sale hoy' : `Sale el ${fechaCorta(d.fecha)}`
  if (p?.mismoDia && !p.texto) return d.hoy ? `Llega hoy · ${tiempo}` : `${sale} · ${tiempo}`
  if (!tiempo) return sale
  return p?.texto ? `${sale} · ${tiempo}` : `${sale} · llega en ${tiempo.replace(/^hasta /, 'máximo ')}`
}

export interface BarraEnvioGratis {
  falta: number
  desde: number
  /** 0 a 100. */
  porcentaje: number
}

/** «Te faltan $ 65.000 para envío gratis» con su progreso; null si no aplica o ya es gratis. */
export function barraEnvioGratis(c: CotizacionPublica): BarraEnvioGratis | null {
  if (c.envio_gratis || c.envio_gratis_desde == null || c.falta_para_envio_gratis == null) return null
  const desde = Number(c.envio_gratis_desde)
  const falta = Number(c.falta_para_envio_gratis)
  if (!(desde > 0) || !(falta > 0)) return null
  const porcentaje = Math.min(100, Math.max(0, Math.round(((desde - falta) / desde) * 100)))
  return { falta, desde, porcentaje }
}

/** Detalle de la tarjeta «Domicilio»: «Lo lleva la tienda · Zona 2 Chapinero» o «Fuera de zona · tarifa general». */
export function detalleZona(c: CotizacionPublica): string {
  const e = envioDeZona(c)
  if (!e.ok) return e.codigo === 'PEDIDO_MINIMO_DOMICILIO' ? `Pedido mínimo para domicilio` : 'Sin domicilio para esta dirección'
  if (e.fueraDeZona) return 'Fuera de zona · tarifa general'
  return e.zonaNombre ? `Lo lleva la tienda · ${e.zonaNombre}` : 'Lo lleva la tienda'
}
