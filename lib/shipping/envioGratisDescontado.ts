/**
 * Envío gratis medido DESPUÉS de los descuentos (decisión del dueño, 2026-11-24).
 *
 * «Envío gratis desde $ 150.000» se compara con lo que la persona paga por los productos: el
 * subtotal menos las promociones y el cupón. Antes se comparaba con el subtotal a precio normal,
 * así que un carrito de $ 160.000 con $ 20.000 de descuento salía con envío gratis.
 *
 * Puro y sin imports. Lo usan:
 *  - /api/orders (lo que se cobra): tarifa plana y tarifas de Transporte (`resolverEnvio` recibe
 *    el subtotal descontado: ese subtotal SOLO decide el envío gratis) y domicilio por zona
 *    (`cotizarDomicilioWeb` → `cotizacionConEnvioGratisDescontado`).
 *  - /api/shipping/quote, el checkout, el cajón y /carrito (lo que se muestra).
 *
 * Domicilio por zona: el umbral vive en `logistica_cotizar_envio` (ERP), que compara
 * `p_subtotal` con `free_shipping_from` y con el pedido mínimo y las reglas de despacho. Para no
 * cambiar el pedido mínimo ni las reglas (siguen con el subtotal a precio normal), a la base se le
 * sigue pasando el subtotal normal y el envío gratis se vuelve a decidir aquí con el descontado.
 * Cuando la función SQL acepte `p_opciones.subtotal_envio_gratis`, esto sobra.
 */

/** Subtotal con el que se mide el envío gratis: el normal menos los descuentos, nunca negativo. */
export function subtotalParaEnvioGratis(subtotalNormal: number, descuentos: number): number {
  const bruto = Number(subtotalNormal)
  const menos = Number(descuentos)
  const base = Number.isFinite(bruto) ? bruto : 0
  const desc = Number.isFinite(menos) && menos > 0 ? menos : 0
  return Math.max(0, Math.round((base - desc) * 100) / 100)
}

/** ¿Ese subtotal ya alcanza el umbral? Sin umbral (0, negativo o vacío), no hay envío gratis. */
export function alcanzaEnvioGratis(subtotal: number, umbral: number | null | undefined): boolean {
  const u = Number(umbral)
  return Number.isFinite(u) && u > 0 && Number(subtotal) >= u
}

/** Lo que falta para el envío gratis (0 si ya lo alcanza o no hay umbral). */
export function faltaParaEnvioGratis(subtotal: number, umbral: number | null | undefined): number {
  const u = Number(umbral)
  if (!Number.isFinite(u) || u <= 0) return 0
  return Math.max(0, Math.round((u - Number(subtotal || 0)) * 100) / 100)
}

/** Lo que este módulo necesita de la respuesta de `logistica_cotizar_envio`. */
export interface CotizacionEnvioGratis {
  precio: number | null
  tarifa: number | null
  envio_gratis: boolean
  envio_gratis_desde: number | null
  falta_para_envio_gratis: number | null
  /** Subtotal con el que cotizó la base (el normal). */
  subtotal: number
}

/**
 * La cotización con el envío gratis decidido sobre el subtotal descontado. Solo puede QUITAR un
 * envío gratis que la base dio con el subtotal normal (el descontado nunca es mayor); nunca lo da.
 * Sin subtotal descontado, sin umbral de envío gratis o fuera de cobertura: la cotización tal cual.
 */
export function cotizacionConEnvioGratisDescontado<T extends CotizacionEnvioGratis>(c: T, subtotalDescontado: number | null | undefined): T {
  if (subtotalDescontado === null || subtotalDescontado === undefined) return c
  const pedido = Number(subtotalDescontado)
  if (!Number.isFinite(pedido)) return c
  if (c.precio === null || c.envio_gratis_desde === null || c.envio_gratis_desde === undefined) return c
  const desde = Number(c.envio_gratis_desde)
  // Nunca por encima del subtotal con el que cotizó la base: el descontado no puede dar envío gratis.
  const base = Math.min(pedido, Number.isFinite(Number(c.subtotal)) ? Number(c.subtotal) : pedido)
  if (base >= desde) return c
  if (c.envio_gratis) {
    // La base lo dio gratis con el subtotal normal; con los descuentos no alcanza: la tarifa.
    // Sin tarifa conocida no se inventa un cobro: queda como la dio la base.
    if (c.tarifa === null || !Number.isFinite(Number(c.tarifa))) return c
    return { ...c, envio_gratis: false, precio: Number(c.tarifa), falta_para_envio_gratis: faltaParaEnvioGratis(base, desde) }
  }
  return { ...c, falta_para_envio_gratis: faltaParaEnvioGratis(base, desde) }
}
