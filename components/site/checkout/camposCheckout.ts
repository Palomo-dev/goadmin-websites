/**
 * Campos del formulario del checkout v2, en una lista DECLARATIVA (Figma «16 Sitio web» › Checkout
 * v2, A1/A1b/B; aprobado por el dueño el 2026-11-24).
 *
 * Fase 1: la lista por defecto es la de las pantallas aprobadas (lo que el checkout pide hoy, con
 * «Nombre y apellido» en un solo campo y el celular con su país). Fase 2 (Parte F 3141-93709: Opciones
 * del checkout › Formulario del checkout en el ERP, 2026-11-25): el ERP guarda qué campos se
 * muestran, en qué orden, cuáles son obligatorios y sus textos (organization_settings
 * `checkout_formulario`); `camposDelCheckout(config)` aplica esa configuración sobre esta lista con
 * la regla COMPARTIDA con el ERP (lib/website/formularioCheckout.ts: orden y candados). Sin
 * configuración devuelve esta lista tal cual: el checkout de siempre. Lo que la configuración NO
 * puede quitar: correo, nombre, dirección y municipio con domicilio (el porqué, en ese módulo).
 *
 * Puro (sin React): lo usan el checkout, `reglasCheckout.ts` y `scripts/verify-checkout-v2.mjs`.
 * El orden de la lista es el de la pantalla (la ciudad antes del barrio, que sale con la zona).
 */

import { resolverFormulario, type AjusteCampoFormulario, type ClaveCampoFormulario } from '../../../lib/website/formularioCheckout'

export type ClaveCampo = ClaveCampoFormulario

export type SeccionCampo = 'contacto' | 'entrega'

export interface CampoCheckout {
  clave: ClaveCampo
  seccion: SeccionCampo
  etiqueta: string
  /** Texto pequeño bajo el campo. */
  ayuda: string | null
  placeholder: string | null
  visible: boolean
  obligatorio: boolean
  /** Atributos del teclado y del autocompletado del navegador. */
  tipo: 'text' | 'email' | 'tel'
  autoComplete: string | null
  inputMode: 'text' | 'email' | 'tel' | 'numeric' | null
  /**
   * Solo `nombre`: exigir apellido (dos palabras). Por defecto NO: hoy el apellido no se validaba y
   * una sola palabra deja comprar (queda como first_name y last_name vacío). La fase 2 lo activa.
   */
  exigirApellido?: boolean
  /** Con configuración: la etiqueta la escribió el ERP (el checkout no la cambia por contexto). */
  etiquetaPropia?: boolean
}

/** La lista por defecto: lo de las pantallas aprobadas. El orden es el de la pantalla. */
export const CAMPOS_CHECKOUT_POR_DEFECTO: readonly CampoCheckout[] = [
  { clave: 'email', seccion: 'contacto', etiqueta: 'Correo electrónico', ayuda: 'Aquí te llega la confirmación', placeholder: 'tu@correo.com', visible: true, obligatorio: true, tipo: 'email', autoComplete: 'email', inputMode: 'email' },
  { clave: 'celular', seccion: 'contacto', etiqueta: 'Celular', ayuda: 'Para coordinar la entrega', placeholder: null, visible: true, obligatorio: true, tipo: 'tel', autoComplete: 'tel-national', inputMode: 'tel' },
  { clave: 'nombre', seccion: 'contacto', etiqueta: 'Nombre y apellido', ayuda: null, placeholder: 'Ej.: Laura Pérez', visible: true, obligatorio: true, tipo: 'text', autoComplete: 'name', inputMode: 'text', exigirApellido: false },
  { clave: 'factura', seccion: 'contacto', etiqueta: 'Necesito factura a nombre de empresa', ayuda: 'Opcional · con NIT, cédula u otro documento', placeholder: null, visible: true, obligatorio: false, tipo: 'text', autoComplete: null, inputMode: null },
  { clave: 'direccion', seccion: 'entrega', etiqueta: 'Dirección', ayuda: 'Calle, carrera o avenida y número', placeholder: 'Ej.: Cra 7 # 45-12', visible: true, obligatorio: true, tipo: 'text', autoComplete: 'address-line1', inputMode: 'text' },
  { clave: 'complemento', seccion: 'entrega', etiqueta: 'Apto, casa u oficina (opcional)', ayuda: null, placeholder: 'Ej.: Apto 301', visible: true, obligatorio: false, tipo: 'text', autoComplete: 'address-line2', inputMode: 'text' },
  { clave: 'ciudad', seccion: 'entrega', etiqueta: 'Ciudad o municipio', ayuda: 'Escribe para buscar; si no aparece, escríbela completa', placeholder: 'Escribe para buscar', visible: true, obligatorio: true, tipo: 'text', autoComplete: 'address-level2', inputMode: 'text' },
  { clave: 'barrio', seccion: 'entrega', etiqueta: 'Barrio', ayuda: null, placeholder: 'Ej.: Chapinero', visible: true, obligatorio: false, tipo: 'text', autoComplete: 'address-level3', inputMode: 'text' },
  { clave: 'notas', seccion: 'entrega', etiqueta: 'Indicaciones para la entrega (opcional)', ayuda: null, placeholder: 'Ej.: el timbre no sirve, llamar al llegar', visible: true, obligatorio: false, tipo: 'text', autoComplete: null, inputMode: 'text' },
]

/**
 * Lo que el ERP puede cambiar de un campo (fase 2): el mismo tipo que guarda el configurador
 * (lib/website/formularioCheckout.ts, copia byte a byte del ERP).
 */
export type AjusteCampo = AjusteCampoFormulario

/** «Apto, casa u oficina (opcional)» → «Apto, casa u oficina». */
export function sinOpcional(etiqueta: string): string {
  return etiqueta.replace(/\s*\(opcional\)\s*$/i, '').trim()
}

/** Etiqueta con «(opcional)» al final si el campo es opcional (la casilla de factura no lo lleva). */
export function etiquetaConOpcional(base: string, obligatorio: boolean, clave: ClaveCampo): string {
  const limpia = sinOpcional(base)
  return obligatorio || clave === 'factura' ? limpia : `${limpia} (opcional)`
}

/**
 * La lista del checkout: la por defecto con los ajustes del ERP encima (fase 2). Sin ajustes
 * (`null`, `undefined` o lista vacía) devuelve la por defecto tal cual: el checkout de la fase 1.
 * Con ajustes, la regla compartida con el ERP (`resolverFormulario`) da el orden y los candados:
 * correo, nombre, dirección y municipio no se esconden ni se vuelven opcionales, el barrio no se
 * esconde y las indicaciones van al final. Con configuración, «(opcional)» se agrega solo a las
 * etiquetas de los campos opcionales (Figma F: «se agrega solo»).
 */
export function camposDelCheckout(ajustes?: readonly AjusteCampo[] | null): CampoCheckout[] {
  const resueltos = resolverFormulario(ajustes)
  if (!resueltos) {
    return CAMPOS_CHECKOUT_POR_DEFECTO.map((c) => ({ ...c }))
  } else {
    return resueltos.map((r) => {
      const c = CAMPOS_CHECKOUT_POR_DEFECTO.find((d) => d.clave === r.clave) as CampoCheckout
      const propia = r.etiqueta !== undefined
      return {
        ...c,
        visible: r.visible,
        obligatorio: r.obligatorio,
        etiqueta: etiquetaConOpcional(propia ? (r.etiqueta as string) : c.etiqueta, r.obligatorio, c.clave),
        ...(propia ? { etiquetaPropia: true } : {}),
        ayuda: r.ayuda === undefined ? c.ayuda : r.ayuda,
        placeholder: r.placeholder === undefined ? c.placeholder : r.placeholder,
        ...(c.clave === 'nombre' ? { exigirApellido: r.exigirApellido ?? c.exigirApellido } : {}),
      }
    })
  }
}

/** El campo de una lista (siempre existe: la lista sale de la por defecto). */
export function campo(lista: readonly CampoCheckout[], clave: ClaveCampo): CampoCheckout {
  return lista.find((c) => c.clave === clave) ?? (CAMPOS_CHECKOUT_POR_DEFECTO.find((c) => c.clave === clave) as CampoCheckout)
}
