/**
 * Carta QR por pasos (Figma 2032:75742, láminas 01–10): en «modo mesa» la página muestra UN paso
 * a la vez, como las pantallas de Figma, en vez de todas las secciones apiladas.
 *
 *   bienvenida (01) → carta (02) → pedido (04) → estado (06)
 *                          └→ cuenta (08) → pagar (09) → valorar (10)
 *   bienvenida → horario (Horario y sedes: no está en el flujo de Figma, va como enlace)
 *
 * El paso vive en la URL (`?mesa=…&paso=carta`): el botón atrás del celular funciona y recargar no
 * lo pierde. Un paso existe solo si la página tiene visible la sección que lo pinta; un paso que no
 * existe (o basura en la URL) cae en el paso de inicio (la bienvenida si la hay).
 *
 * Código puro: sin React, Next ni Supabase (lo carga scripts/verify-carta-qr.mjs).
 */

export type PasoMesa = 'bienvenida' | 'carta' | 'pedido' | 'estado' | 'cuenta' | 'pagar' | 'valorar' | 'horario'

export const PASOS_MESA: readonly PasoMesa[] = ['bienvenida', 'carta', 'pedido', 'estado', 'cuenta', 'pagar', 'valorar', 'horario']

export interface SeccionParaPasos {
  id?: string
  section_type: string
  section_variant?: string | null
  is_visible?: boolean | null
  settings?: unknown
}

/**
 * Paso que muestra una sección: el que pide el lienzo del editor al seleccionarla (lámina 17: al
 * editar «Cuenta de la mesa», el lienzo muestra la cuenta). Encabezado y pie, en la bienvenida.
 */
export function pasoDeSeccion(tipo: string, variante?: string | null): PasoMesa {
  switch (tipo) {
    case 'header':
    case 'footer':
      return 'bienvenida'
    case 'restaurant_hero':
      return variante === 'mesa' ? 'bienvenida' : 'carta'
    case 'table_service':
    case 'menu_full':
      return 'carta'
    case 'table_order':
      return 'pedido'
    case 'table_bill':
      return 'cuenta'
    case 'visit_feedback':
      return 'valorar'
    case 'hours_location':
      return 'horario'
    default:
      // Cualquier otra sección que el dueño agregue a la Carta QR va debajo de la carta.
      return 'carta'
  }
}

/**
 * Pasos en los que se pinta una sección. «Pedido de la mesa» se pinta en la carta (su barra
 * «Ver pedido de la mesa · $») y en sus pantallas; «Cuenta de la mesa», en la cuenta y en pagar.
 */
export function pasosDeSeccion(tipo: string, variante?: string | null): PasoMesa[] {
  switch (tipo) {
    case 'table_order':
      return ['carta', 'pedido', 'estado']
    case 'table_bill':
      return ['cuenta', 'pagar']
    default:
      return [pasoDeSeccion(tipo, variante)]
  }
}

/**
 * ¿Se ve en el celular? La misma regla que modoMesa.ts (`cartaQrRecibeMesa`): ojo cerrado = oculta;
 * la visibilidad fina {computador, tableta, celular} manda si trae los tres. El QR se lee con el celular.
 */
export function seccionVisibleEnMesa(s: SeccionParaPasos): boolean {
  if (s.is_visible === false) return false
  const ajustes = s.settings
  const fina = ajustes && typeof ajustes === 'object' ? (ajustes as { visibilidad?: unknown }).visibilidad : null
  if (fina && typeof fina === 'object') {
    const v = fina as { computador?: unknown; tableta?: unknown; celular?: unknown }
    if (typeof v.computador === 'boolean' && typeof v.tableta === 'boolean' && typeof v.celular === 'boolean') return v.celular
  }
  return true
}

export interface PasosDisponibles {
  /** Pasos que existen en la página, en el orden del flujo. */
  pasos: PasoMesa[]
  /** Hay «Servicio de mesa» visible: la hoja «Llamar al mesero» (lámina 07) existe. */
  mesero: boolean
}

/** Pasos que existen según las secciones VISIBLES de la página. */
export function pasosDisponibles(secciones: ReadonlyArray<SeccionParaPasos> | null | undefined): PasosDisponibles {
  const hay = new Set<PasoMesa>()
  let mesero = false
  for (const s of secciones ?? []) {
    if (!seccionVisibleEnMesa(s)) continue
    if (s.section_type === 'table_service') mesero = true
    for (const p of pasosDeSeccion(s.section_type, s.section_variant)) hay.add(p)
  }
  return { pasos: PASOS_MESA.filter((p) => hay.has(p)), mesero }
}

/** El paso donde arranca la mesa: la bienvenida; sin ella, la carta; sin las dos, el primero que haya. */
export function pasoInicio(pasos: readonly PasoMesa[]): PasoMesa {
  if (pasos.includes('bienvenida')) return 'bienvenida'
  if (pasos.includes('carta')) return 'carta'
  return pasos[0] ?? 'bienvenida'
}

/** El paso de la URL si existe en la página; si no (o basura), el de inicio. */
export function resolverPaso(valor: unknown, pasos: readonly PasoMesa[]): PasoMesa {
  if (typeof valor === 'string' && (pasos as readonly string[]).includes(valor)) return valor as PasoMesa
  return pasoInicio(pasos)
}

/**
 * Transiciones permitidas (botones de cada lámina). La bienvenida y su ☰ llevan a todo; la carta,
 * a su barra (Mesero es una hoja, no un paso) y a la barra inferior; el pedido, a enviar y estado;
 * la cuenta, a pagar y valorar. La vuelta de la pasarela (?ref=CQR-…) llega a «valorar».
 */
export const TRANSICIONES_MESA: Readonly<Record<PasoMesa, readonly PasoMesa[]>> = {
  bienvenida: ['carta', 'pedido', 'cuenta', 'valorar', 'horario'],
  carta: ['bienvenida', 'pedido', 'cuenta'],
  pedido: ['carta', 'estado'],
  estado: ['carta', 'pedido'],
  cuenta: ['carta', 'pagar', 'valorar'],
  pagar: ['cuenta', 'valorar'],
  valorar: ['carta', 'bienvenida'],
  horario: ['bienvenida', 'carta'],
}

/** ¿Se puede ir de `desde` a `hacia`? El destino tiene que existir en la página. */
export function puedeIrAPaso(desde: PasoMesa, hacia: PasoMesa, pasos: readonly PasoMesa[]): boolean {
  if (!pasos.includes(hacia)) return false
  if (desde === hacia) return true
  return TRANSICIONES_MESA[desde].includes(hacia)
}

/** ← atrás de cada pantalla (láminas 04, 08, 09): pedido y cuenta vuelven a la carta; pagar, a la cuenta. */
export function pasoAnterior(paso: PasoMesa, pasos: readonly PasoMesa[]): PasoMesa {
  const destino: Record<PasoMesa, PasoMesa> = {
    bienvenida: 'bienvenida',
    carta: 'bienvenida',
    pedido: 'carta',
    estado: 'carta',
    cuenta: 'carta',
    pagar: 'cuenta',
    valorar: 'carta',
    horario: 'bienvenida',
  }
  const d = destino[paso]
  return pasos.includes(d) ? d : pasoInicio(pasos)
}

/** Las pantallas del almacén de la mesa (overlay #pedido, #cuenta…) que corresponden a un paso. */
export function pantallaDePaso(paso: PasoMesa): '' | 'pedido' | 'estado' | 'cuenta' | 'pagar' | 'valorar' {
  return paso === 'pedido' || paso === 'estado' || paso === 'cuenta' || paso === 'pagar' || paso === 'valorar' ? paso : ''
}

/** ¿Encabezado y pie del sitio en este paso? Solo en el de inicio (lámina 01); las demás son pantallas. */
export function pasoConEncabezado(paso: PasoMesa, pasos: readonly PasoMesa[]): boolean {
  return paso === pasoInicio(pasos)
}
