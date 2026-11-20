/**
 * «Domicilio» y «Transportadora» en el checkout (Figma «16 Sitio web» 2686:57152, aprobado el
 * 2026-11-19).
 *
 * - «Cómo reciben el pedido» (`available_delivery_types`): `delivery_own` → «Domicilio» (lo lleva
 *   la tienda), `delivery_third_party` → «Transportadora». Con los dos activos, el cliente elige.
 * - Las tarifas son las de Transporte › Tarifas de envío con «Web». La transportadora de cada una
 *   dice su grupo: `third_party` → Transportadora; flota propia o sin transportadora → Domicilio.
 *   Con un solo tipo activo, ese tipo usa todas las tarifas (como antes).
 * - Precio: la tarifa más barata («desde $ X» si hay varias con precios distintos). Sin tarifas:
 *   la tarifa plana del sitio y sin tiempo. Tiempo: días estimados (0 = Hoy, 1 = Mañana).
 *
 * Puro: checkout, /api/orders y scripts/verify-domicilio-transportadora.mjs.
 */

export type GrupoEnvio = 'own' | 'third_party'

export const TIPO_ENTREGA_DE_GRUPO: Record<GrupoEnvio, 'delivery_own' | 'delivery_third_party'> = {
  own: 'delivery_own',
  third_party: 'delivery_third_party',
}

/** Grupo de una tarifa por el tipo de su transportadora (`transport_carriers.carrier_type`). */
export function grupoDeTransportadora(carrierType: unknown): GrupoEnvio {
  return carrierType === 'third_party' ? 'third_party' : 'own'
}

/**
 * Tipos de domicilio activos, en el orden del checkout. Sin lista (sitio sin ajustes): solo
 * «Domicilio», el botón de siempre. Una lista sin domicilio: ninguno.
 */
export function gruposActivos(tipos: readonly string[] | null | undefined): GrupoEnvio[] {
  if (!Array.isArray(tipos)) return ['own']
  const grupos: GrupoEnvio[] = []
  if (tipos.includes('delivery_own')) grupos.push('own')
  if (tipos.includes('delivery_third_party')) grupos.push('third_party')
  return grupos
}

/** Tarifas de un grupo: con los dos tipos activos, las suyas; con uno solo, todas (como antes). */
export function tarifasDelGrupo<T extends { grupo?: GrupoEnvio | null }>(tarifas: readonly T[], grupo: GrupoEnvio, activos: readonly GrupoEnvio[]): T[] {
  if (activos.length < 2) return [...tarifas]
  return tarifas.filter((t) => (t.grupo ?? 'own') === grupo)
}

/** «Hoy», «Mañana», «3 días» o «2–5 días» con los días estimados de las tarifas; sin dato, `null`. */
export function textoDias(dias: readonly (number | null | undefined)[]): string | null {
  const validos = dias.filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d >= 0).map((d) => Math.round(d))
  if (validos.length === 0) return null
  const min = Math.min(...validos)
  const max = Math.max(...validos)
  const uno = (d: number) => (d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `${d} días`)
  if (min === max) return uno(min)
  if (min === 0 && max === 1) return 'Hoy o mañana'
  return `${min}–${max} días`
}

export interface PlanaEnvio {
  activo: boolean
  tarifa: number
  umbralGratis: number
}

/** Envío con la tarifa plana del sitio (sin tarifas del grupo): 0 si está apagado o si llega al umbral. */
export function costoPlano(plana: PlanaEnvio, subtotal: number): number {
  if (!plana.activo) return 0
  if (plana.umbralGratis > 0 && subtotal >= plana.umbralGratis) return 0
  return Math.max(0, plana.tarifa)
}

export interface ResumenDomicilio {
  grupo: GrupoEnvio
  titulo: string
  detalle: string
  /** Costo mínimo del grupo (o el plano). */
  costo: number
  /** Hay varias tarifas con precios distintos: el precio va con «desde». */
  desde: boolean
  tiempo: string | null
}

/**
 * Lo que muestra la tarjeta de cada tipo de domicilio. `detalleUnico` es el texto de hoy cuando
 * hay un solo tipo («Te lo llevamos a tu dirección»).
 */
export function resumenDomicilio(
  grupo: GrupoEnvio,
  tarifas: readonly { cost: number; dias?: number | null }[],
  plana: PlanaEnvio,
  subtotal: number,
  activos: readonly GrupoEnvio[],
  detalleUnico = 'Te lo llevamos a tu dirección',
): ResumenDomicilio {
  const titulo = grupo === 'third_party' ? 'Transportadora' : 'Domicilio'
  const detalle = activos.length < 2 ? detalleUnico : grupo === 'third_party' ? 'Envío con transportadora' : 'Lo lleva la tienda'
  if (tarifas.length === 0) {
    return { grupo, titulo, detalle, costo: costoPlano(plana, subtotal), desde: false, tiempo: null }
  }
  const costos = tarifas.map((t) => t.cost)
  const costo = Math.min(...costos)
  return {
    grupo,
    titulo,
    detalle,
    costo,
    desde: new Set(costos).size > 1,
    tiempo: textoDias(tarifas.map((t) => t.dias)),
  }
}

/**
 * Tipo de entrega que se guarda para un pedido a domicilio: el del grupo elegido si está activo;
 * si no (o sin grupo), el que tenga la tienda (solo tercero → tercero; si no, propio).
 */
export function tipoDomicilioGuardado(grupo: unknown, tipos: readonly string[] | null | undefined): 'delivery_own' | 'delivery_third_party' {
  const activos = gruposActivos(tipos)
  if ((grupo === 'own' || grupo === 'third_party') && activos.includes(grupo)) return TIPO_ENTREGA_DE_GRUPO[grupo]
  return activos.length === 1 && activos[0] === 'third_party' ? 'delivery_third_party' : 'delivery_own'
}
