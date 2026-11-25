/**
 * Cómo pinta el checkout los campos en el orden que eligió el ERP (Checkout v2, Parte F
 * 3141-93709). Puro: decide filas y bloques; el JSX sigue en CheckoutWizard.tsx. Sin configuración
 * (la lista por defecto) devuelve EXACTAMENTE la distribución de siempre:
 * - Contacto: [correo · celular] en una fila de dos columnas, nombre, casilla de factura.
 * - Entrega: dirección, apto y municipio en el bloque de la dirección; el barrio con la zona del
 *   domicilio propio (debajo, con sus avisos); las indicaciones al final.
 *
 * Lo usan el checkout y `scripts/verify-formulario-checkout.mjs`.
 */

import { CAMPOS_CHECKOUT_POR_DEFECTO, campo, type CampoCheckout, type ClaveCampo } from './camposCheckout'

/**
 * Filas de la sección «Contacto»: los campos visibles en su orden; correo y celular juntos (en
 * cualquier orden) comparten una fila de dos columnas, como hoy. Los demás, una fila cada uno.
 */
export function filasContacto(campos: readonly CampoCheckout[]): ClaveCampo[][] {
  const visibles = campos.filter((c) => c.seccion === 'contacto' && c.visible).map((c) => c.clave)
  const filas: ClaveCampo[][] = []
  for (let i = 0; i < visibles.length; i++) {
    const k = visibles[i]
    const sig = visibles[i + 1]
    const par = (k === 'email' && sig === 'celular') || (k === 'celular' && sig === 'email')
    if (par) {
      filas.push([k, sig])
      i++
    } else {
      filas.push([k])
    }
  }
  return filas
}

export interface PlanEntrega {
  /** Campos del bloque de la dirección, en orden (el barrio, solo si NO va al final). */
  bloque: ClaveCampo[]
  /** El barrio va con la zona del domicilio propio, debajo de la dirección (lo de siempre). */
  barrioEnZona: boolean
}

/**
 * La dirección de entrega: dirección, apto, municipio y barrio en el orden elegido (las indicaciones
 * van siempre al final, fuera de este plan). Si el barrio queda de último sigue saliendo con la
 * zona, como hoy; si el ERP lo subió, sale dentro del bloque en su lugar (igual solo cuando la zona
 * lo pide).
 */
export function planEntrega(campos: readonly CampoCheckout[]): PlanEntrega {
  const orden = campos
    .filter((c) => c.seccion === 'entrega' && c.clave !== 'notas' && c.visible)
    .map((c) => c.clave)
  const barrioEnZona = orden.length > 0 && orden[orden.length - 1] === 'barrio'
  return { bloque: barrioEnZona ? orden.slice(0, -1) : orden, barrioEnZona }
}

/**
 * Texto de ejemplo que eligió el ERP para un campo cuyo componente trae el suyo (celular y
 * municipio): `undefined` si es el de siempre, para que la pieza siga poniendo el propio.
 */
export function ejemploPropio(campos: readonly CampoCheckout[], clave: ClaveCampo): string | undefined {
  const actual = campo(campos, clave).placeholder
  const defecto = campo(CAMPOS_CHECKOUT_POR_DEFECTO, clave).placeholder
  return actual === defecto || actual === null ? undefined : actual
}
