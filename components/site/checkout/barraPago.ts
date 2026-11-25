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
 * Computador (Figma «16 Sitio web» › «Barra de pago en computador» 3214:110908, aprobada por el
 * dueño el 2026-11-25): los MISMOS tres estilos y el mismo ajuste, con el resumen corto a la
 * izquierda (miniaturas, «N productos», «Ver resumen» y la línea de contexto) y, a la derecha, lo
 * del estilo. `contenidoBarraPagoComputador` parte de `contenidoBarraPago` y solo cambia lo que el
 * computador tiene espacio para decir (la pasarela dentro del botón de A y en la acción de C; la
 * palabra «anticipo» en A; la etiqueta «hoy» del monto de C con anticipo).
 *
 * Puro (sin React, sin imports): lo usan `BarraPagoMovil.tsx`, `BarraPagoComputador.tsx`, la página
 * del checkout y `scripts/verify-barra-pago.mjs`. Los montos llegan ya formateados con la moneda de
 * la tienda.
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
  /**
   * Checkout v2 (2026-11-24): transferencia u otro método que NO cobra en línea. El botón dice
   * «Confirmar pedido» (nunca «Pagar» si no se cobra nada aquí). `medio`: «transferencia».
   */
  | { tipo: 'confirmar'; total: string; productos: number; envio: 'incluido' | 'gratis' | null; medio: string }

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

/** «<corto> con Pasarela» si cabe en `max`; si no (o sin pasarela), `corto`. */
function conPasarela(corto: string, pasarela: string | null, max: number): string {
  if (!pasarela) return corto
  const largo = `${corto} con ${pasarela}`
  return largo.length <= max ? largo : corto
}

/** A: «Pagar $ X con Pasarela»; si no cabe, sin «con …». */
function textoBotonA(monto: string, pasarela: string | null): string {
  return conPasarela(`Pagar ${monto}`, pasarela, MAX_TEXTO_BOTON_A)
}

/**
 * C: «Pagar anticipo con Bold»; si no cabe, «Pagar con Mercado Pago» (y el CSS recorta con «…»).
 * `max`: caracteres de la acción (por defecto los del celular; el computador tiene más espacio).
 */
export function accionAnticipoC(pasarela: string | null, max: number = MAX_ACCION_C): string {
  if (!pasarela) return 'Pagar anticipo'
  const largo = `Pagar anticipo con ${pasarela}`
  return largo.length <= max ? largo : `Pagar con ${pasarela}`
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

  if (caso.tipo === 'confirmar') {
    // Sin cobro en línea: el mismo botón «Confirmar pedido» con check en los tres estilos.
    const productos = plural(caso.productos, 'producto', 'productos')
    if (estilo === 'dos_filas') {
      return { ...base, columnas: [{ etiqueta: `Total · ${productos}`, valor: caso.total, destacado: true }], enlace: 'Ver resumen', boton: boton('check', 'Confirmar pedido') }
    }
    if (estilo === 'dos_lineas') {
      return { ...base, total: caso.total, enlace: 'Ver resumen', boton: boton('check', 'Confirmar pedido', { linea2: `Pagas con ${caso.medio}` }) }
    }
    const partes = [productos, caso.envio === 'incluido' ? 'envío incluido' : caso.envio === 'gratis' ? 'envío gratis' : null, `pagas con ${caso.medio}`].filter(Boolean)
    return { ...base, contexto: partes.join(' · '), enlace: 'Detalle', boton: boton('check', 'Confirmar pedido', { monto: caso.total }) }
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
export function etiquetaAccesibleBoton(c: Pick<ContenidoBarraPago, 'boton'>): string {
  const b = c.boton
  return [b.texto, b.linea2, b.monto ? [b.montoEtiqueta, b.monto].filter(Boolean).join(' ') : null].filter(Boolean).join(', ')
}

// ── Computador (3214:110908) ─────────────────────────────────────────────────────────────────────

/** Caracteres del botón de A en computador (≈ 340 px a 16 px seminegrita, con el ícono). */
export const MAX_TEXTO_BOTON_A_COMPUTADOR = 44
/** Caracteres de la acción de C en computador (botón de 440 px; el monto se queda con su lado). */
export const MAX_ACCION_C_COMPUTADOR = 32

/** Lo que la barra de computador dice a la izquierda, además del caso. Montos ya formateados. */
export interface ResumenCortoBarra {
  /** Unidades del carrito. */
  productos: number
  /** A domicilio: «Envío incluido» / «Envío gratis»; recoger o comer aquí: null. */
  envio: 'incluido' | 'gratis' | null
  /** Descuento de promociones, formateado; null sin descuento. */
  ahorro: string | null
  /** «Se cobra en COP: $ X» (`textoCobroEnBase`) si los precios se ven en otra moneda; si no, null. */
  cobroEnBase: string | null
}

export type IconoContexto = 'paquete' | 'porcentaje' | 'billete'

/** Una pieza de la línea de contexto (se separan con «·»). */
export interface PiezaContexto {
  texto: string
  icono: IconoContexto | null
  /** Verde: el ahorro y «Pagas todo al recibir». */
  verde: boolean
  /** Es el «Se cobra en …» (lleva `data-cobro-base`). */
  cobroEnBase: boolean
}

export interface ContenidoBarraComputador {
  estilo: EstiloBarraPago
  /** «3 productos». */
  productos: string
  /** Línea de contexto bajo «N productos». */
  contexto: PiezaContexto[]
  /** A: columnas de montos junto al botón (1, o 3 con anticipo). B y C: vacío. */
  columnas: ColumnaMonto[]
  /** B: «Total $ X» junto al botón. A y C: null. */
  total: string | null
  /** Las piezas del botón (A texto; B dos líneas; C acción + monto). */
  boton: BotonBarra
}

function pieza(texto: string, icono: IconoContexto | null = null, verde = false, cobroEnBase = false): PiezaContexto {
  return { texto, icono, verde, cobroEnBase }
}

/** Línea de contexto de la izquierda (igual en los tres estilos, salvo el anticipo). */
function contextoComputador(estilo: EstiloBarraPago, caso: CasoBarraPago, r: ResumenCortoBarra): PiezaContexto[] {
  const envio = r.envio === 'incluido' ? pieza('Envío incluido', 'paquete') : r.envio === 'gratis' ? pieza('Envío gratis', 'paquete') : null
  let partes: (PiezaContexto | null)[]
  if (caso.tipo === 'anticipo') {
    partes = estilo === 'partido'
      // C: el monto de hoy va en el botón; aquí, el total y lo de la puerta.
      ? [pieza(`Total ${caso.total}`, 'billete'), pieza(`al recibir ${caso.alRecibir}`)]
      : [envio, pieza(estilo === 'dos_lineas' ? 'Contraentrega con anticipo' : 'Contraentrega', 'billete')]
  } else if (caso.tipo === 'sin_anticipo') {
    partes = [envio, pieza(`Pagas todo al recibir: ${caso.medios}`, 'billete', true)]
  } else if (caso.tipo === 'confirmar') {
    partes = [envio, pieza(`Pagas con ${caso.medio}`)]
  } else {
    partes = [envio]
  }
  if (r.ahorro) partes.push(pieza(`Ahorras ${r.ahorro}`, 'porcentaje', true))
  if (r.cobroEnBase) partes.push(pieza(r.cobroEnBase, null, false, true))
  return partes.filter((p): p is PiezaContexto => p !== null)
}

/**
 * Contenido de la barra de computador para un estilo y un caso. El botón sale de la MISMA regla del
 * celular (`contenidoBarraPago`); el computador solo cambia:
 * - A: la pasarela dentro del botón también en el pago normal («Pagar $ X con Wompi») y la palabra
 *   «anticipo» («Pagar anticipo $ 20.000 con Bold»); si no cabe, sin «con …».
 * - C: la pasarela en la acción («Pagar con Wompi», «Pagar anticipo con Bold») y la etiqueta «hoy»
 *   sobre el monto del anticipo.
 * - B: igual que en celular.
 */
export function contenidoBarraPagoComputador(estilo: EstiloBarraPago, caso: CasoBarraPago, r: ResumenCortoBarra): ContenidoBarraComputador {
  const movil = contenidoBarraPago(estilo, caso)
  const base: ContenidoBarraComputador = {
    estilo,
    productos: plural(r.productos, 'producto', 'productos'),
    contexto: contextoComputador(estilo, caso, r),
    columnas: [],
    total: null,
    boton: movil.boton,
  }

  if (estilo === 'dos_filas') {
    const columnas = caso.tipo === 'anticipo' ? movil.columnas : [{ etiqueta: 'Total', valor: caso.total, destacado: true }]
    if (caso.tipo === 'pago') {
      return { ...base, columnas, boton: { ...movil.boton, texto: conPasarela(`Pagar ${caso.total}`, caso.pasarela, MAX_TEXTO_BOTON_A_COMPUTADOR) } }
    }
    if (caso.tipo === 'anticipo') {
      return { ...base, columnas, boton: { ...movil.boton, texto: conPasarela(`Pagar anticipo ${caso.hoy}`, caso.pasarela, MAX_TEXTO_BOTON_A_COMPUTADOR) } }
    }
    return { ...base, columnas }
  }

  if (estilo === 'dos_lineas') {
    return { ...base, total: caso.total }
  }

  // C · botón partido (por defecto)
  if (caso.tipo === 'pago') {
    return { ...base, boton: { ...movil.boton, texto: conPasarela('Pagar', caso.pasarela, MAX_ACCION_C_COMPUTADOR) } }
  }
  if (caso.tipo === 'anticipo') {
    return { ...base, boton: { ...movil.boton, texto: accionAnticipoC(caso.pasarela, MAX_ACCION_C_COMPUTADOR), montoEtiqueta: 'hoy' } }
  }
  return base
}

/**
 * Estado apagado de la barra de computador: el motivo que el checkout YA conoce (hoy, la
 * contraentrega que no aplica) solo si el botón está apagado y no se está procesando el pago. Sin
 * motivo: null (solo el botón apagado, como antes).
 */
export function motivoBarraApagada(deshabilitado: boolean, procesando: boolean, motivo: string | null | undefined): string | null {
  if (!deshabilitado || procesando) return null
  const texto = typeof motivo === 'string' ? motivo.trim() : ''
  return texto ? texto : null
}
