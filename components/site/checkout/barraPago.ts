/**
 * Barra fija del pago en celular (Figma «16 Sitio web» › «Barra fija del pago en celular»
 * 3059:80757, aprobada por el dueño el 2026-11-24): tres estilos que la tienda elige en el ERP
 * (Sitio web › Ventas en línea › Checkout), por defecto C.
 *
 * - `dos_filas` (A, 3059:81024): los montos arriba, nunca dentro del botón; botón corto
 *   «Pagar $ X [con pasarela]».
 * - `dos_lineas` (B, 3060:81210): arriba solo el total; el botón lleva una línea grande (acción y
 *   monto de hoy) y una pequeña (pasarela y lo de la puerta).
 * - `partido` (C, 3060:81617, POR DEFECTO): una línea de contexto y un botón con la acción a la
 *   izquierda y el monto SIEMPRE a la derecha. Si la acción no cabe, primero sale «anticipo» y
 *   luego se recorta con «…»; el monto nunca se recorta.
 *
 * Cuatro casos en los tres: pago normal, contraentrega con anticipo, contraentrega sin anticipo
 * (no se cobra nada en línea: «Confirmar pedido») y pasarela de nombre largo.
 *
 * Puro (sin React, sin imports): lo usan `BarraPagoMovil.tsx`, la página del checkout y
 * `scripts/verify-barra-pago.mjs`. Los montos llegan ya formateados con la moneda de la tienda.
 */

export const ESTILOS_BARRA_PAGO = ['dos_filas', 'dos_lineas', 'partido'] as const
export type EstiloBarraPago = (typeof ESTILOS_BARRA_PAGO)[number]
/** Sin ajuste guardado (o con uno que no se reconoce): C. */
export const ESTILO_BARRA_POR_DEFECTO: EstiloBarraPago = 'partido'

/** `website_settings.checkout_mobile_bar_style` → estilo; ausente, null o desconocido = C. */
export function normalizarEstiloBarraPago(valor: unknown): EstiloBarraPago {
  return typeof valor === 'string' && (ESTILOS_BARRA_PAGO as readonly string[]).includes(valor)
    ? (valor as EstiloBarraPago)
    : ESTILO_BARRA_POR_DEFECTO
}

/** Lo que se cobra hoy, ya resuelto por el checkout. Montos formateados (`$ 64.900`). */
export type CasoBarraPago =
  /**
   * Pago de siempre. `pasarela` = nombre de la pasarela si el método cobra en línea (Wompi…);
   * null para efectivo sin condiciones o transferencia: el botón dice lo de hoy («Pagar $ X»).
   */
  | { tipo: 'pago'; total: string; productos: number; envio: 'incluido' | 'gratis' | null; pasarela: string | null; ahorro: string | null }
  /** Contraentrega con anticipo: hoy se paga `hoy` en la pasarela y `alRecibir` en la puerta. */
  | { tipo: 'anticipo'; total: string; hoy: string; alRecibir: string; pasarela: string | null }
  /** Contraentrega sin anticipo: no se cobra nada en línea. `medios`: «efectivo, datáfono o Nequi». */
  | { tipo: 'sin_anticipo'; total: string; alRecibir: string; medios: string }

export type IconoBoton = 'candado' | 'check'

export interface BotonBarra {
  icono: IconoBoton
  /** A: texto único. B: línea grande. C: la acción (izquierda). */
  texto: string
  /** B: línea pequeña (12 px). */
  linea2: string | null
  /** C: monto a la derecha (nunca se recorta). */
  monto: string | null
  /** C: etiqueta pequeña encima del monto («al recibir»). */
  montoEtiqueta: string | null
}

export interface ColumnaMonto {
  etiqueta: string
  valor: string
  destacado: boolean
}

export interface ContenidoBarraPago {
  estilo: EstiloBarraPago
  /** A: columnas de montos arriba (1 o 3). */
  columnas: ColumnaMonto[]
  /** B: total de la fila de arriba. A/C: no aplica. */
  total: string | null
  /** C: línea de contexto (12 px). B: el ahorro, si hay. */
  contexto: string | null
  /** C: la línea de contexto en verde con billete (contraentrega sin anticipo). */
  contextoAlRecibir: boolean
  /** A: chip verde «Todo al recibir» (contraentrega sin anticipo). */
  chipAlRecibir: string | null
  /** Enlace que lleva al resumen: «Ver resumen», «Ver detalle», «Detalle» o null. */
  enlace: string | null
  boton: BotonBarra
}

/** Caracteres que caben en el botón de A (≈ 326 px a 16 px seminegrita, con el ícono). */
export const MAX_TEXTO_BOTON_A = 34
/** Caracteres de la acción de C (el monto se queda con su lado). */
export const MAX_ACCION_C = 24

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/** «3 productos · envío incluido» (C, pago normal). */
function contextoPago(c: Extract<CasoBarraPago, { tipo: 'pago' }>): string {
  const partes = [plural(c.productos, 'producto', 'productos')]
  if (c.envio === 'incluido') partes.push('envío incluido')
  else if (c.envio === 'gratis') partes.push('envío gratis')
  if (c.ahorro) partes.push(`ahorras ${c.ahorro}`)
  return partes.join(' · ')
}

/** A: «Pagar $ X con Pasarela»; si no cabe, sin «con …». */
function textoBotonA(monto: string, pasarela: string | null): string {
  const corto = `Pagar ${monto}`
  if (!pasarela) return corto
  const largo = `${corto} con ${pasarela}`
  return largo.length <= MAX_TEXTO_BOTON_A ? largo : corto
}

/** C: «Pagar anticipo con Bold»; si no cabe, «Pagar con Mercado Pago» (y el CSS recorta con «…»). */
export function accionAnticipoC(pasarela: string | null): string {
  if (!pasarela) return 'Pagar anticipo'
  const largo = `Pagar anticipo con ${pasarela}`
  return largo.length <= MAX_ACCION_C ? largo : `Pagar con ${pasarela}`
}

function boton(icono: IconoBoton, texto: string, extra: Partial<Omit<BotonBarra, 'icono' | 'texto'>> = {}): BotonBarra {
  return { icono, texto, linea2: null, monto: null, montoEtiqueta: null, ...extra }
}

/** Contenido de la barra para un estilo y un caso. */
export function contenidoBarraPago(estilo: EstiloBarraPago, caso: CasoBarraPago): ContenidoBarraPago {
  const base: ContenidoBarraPago = {
    estilo,
    columnas: [],
    total: null,
    contexto: null,
    contextoAlRecibir: false,
    chipAlRecibir: null,
    enlace: null,
    boton: boton('candado', ''),
  }

  if (estilo === 'dos_filas') {
    if (caso.tipo === 'pago') {
      const etiqueta = [`Total · ${plural(caso.productos, 'producto', 'productos')}`, caso.ahorro ? `ahorras ${caso.ahorro}` : null].filter(Boolean).join(' · ')
      return { ...base, columnas: [{ etiqueta, valor: caso.total, destacado: true }], enlace: 'Ver resumen', boton: boton('candado', textoBotonA(caso.total, null)) }
    }
    if (caso.tipo === 'anticipo') {
      return {
        ...base,
        columnas: [
          { etiqueta: 'Total', valor: caso.total, destacado: false },
          { etiqueta: 'Hoy pagas', valor: caso.hoy, destacado: true },
          { etiqueta: 'Al recibir', valor: caso.alRecibir, destacado: false },
        ],
        boton: boton('candado', textoBotonA(caso.hoy, caso.pasarela)),
      }
    }
    return { ...base, columnas: [{ etiqueta: 'Total', valor: caso.total, destacado: true }], chipAlRecibir: 'Todo al recibir', boton: boton('check', 'Confirmar pedido') }
  }

  if (estilo === 'dos_lineas') {
    if (caso.tipo === 'pago') {
      return {
        ...base,
        total: caso.total,
        contexto: caso.ahorro ? `Ahorras ${caso.ahorro}` : null,
        enlace: 'Ver resumen',
        boton: boton('candado', `Pagar ${caso.total}`, { linea2: caso.pasarela ? `Pago seguro con ${caso.pasarela}` : null }),
      }
    }
    if (caso.tipo === 'anticipo') {
      return {
        ...base,
        total: caso.total,
        enlace: 'Ver detalle',
        boton: boton('candado', `Pagar anticipo · ${caso.hoy}`, {
          linea2: [caso.pasarela ? `con ${caso.pasarela}` : null, `al recibir ${caso.alRecibir}`].filter(Boolean).join(' · '),
        }),
      }
    }
    return { ...base, total: caso.total, enlace: 'Ver detalle', boton: boton('check', 'Confirmar pedido', { linea2: `Pagas ${caso.alRecibir} al recibir` }) }
  }

  // C · botón partido (por defecto)
  if (caso.tipo === 'pago') {
    return { ...base, contexto: contextoPago(caso), enlace: 'Detalle', boton: boton('candado', 'Pagar', { monto: caso.total }) }
  }
  if (caso.tipo === 'anticipo') {
    return {
      ...base,
      contexto: `Total ${caso.total} · al recibir ${caso.alRecibir}`,
      enlace: 'Detalle',
      boton: boton('candado', accionAnticipoC(caso.pasarela), { monto: caso.hoy }),
    }
  }
  return {
    ...base,
    contexto: `Pagas todo al recibir: ${caso.medios}`,
    contextoAlRecibir: true,
    boton: boton('check', 'Confirmar pedido', { monto: caso.alRecibir, montoEtiqueta: 'al recibir' }),
  }
}

/** Texto accesible del botón (lectores de pantalla): todo lo que dice, en una frase. */
export function etiquetaAccesibleBoton(c: ContenidoBarraPago): string {
  const b = c.boton
  return [b.texto, b.linea2, b.monto ? [b.montoEtiqueta, b.monto].filter(Boolean).join(' ') : null].filter(Boolean).join(', ')
}
