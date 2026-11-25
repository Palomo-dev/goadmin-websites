/**
 * Campos del formulario del checkout v2, en una lista DECLARATIVA (Figma «16 Sitio web» › Checkout
 * v2, A1/A1b/B; aprobado por el dueño el 2026-11-24).
 *
 * Fase 1: la lista por defecto es la de las pantallas aprobadas (lo que el checkout pide hoy, con
 * «Nombre y apellido» en un solo campo y el celular con su país). Fase 2 (Parte F: Opciones del
 * checkout › Formulario del checkout en el ERP): el ERP guarda qué campos se muestran, en qué orden,
 * cuáles son obligatorios y sus etiquetas; `camposDelCheckout(config)` aplica esa configuración
 * sobre esta lista sin tocar el checkout. Reglas fijas que la configuración NO puede quitar
 * (lámina D): nombre siempre; correo o celular (al menos uno); dirección y municipio con domicilio.
 *
 * Puro (sin React ni imports): lo usan el checkout, `reglasCheckout.ts` y
 * `scripts/verify-checkout-v2.mjs`.
 */

export type ClaveCampo =
  | 'email'
  | 'celular'
  | 'nombre'
  | 'factura'
  | 'direccion'
  | 'complemento'
  | 'barrio'
  | 'ciudad'
  | 'notas'

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
}

/** La lista por defecto: lo de las pantallas aprobadas. El orden es el de la pantalla. */
export const CAMPOS_CHECKOUT_POR_DEFECTO: readonly CampoCheckout[] = [
  { clave: 'email', seccion: 'contacto', etiqueta: 'Correo electrónico', ayuda: 'Aquí te llega la confirmación', placeholder: 'tu@correo.com', visible: true, obligatorio: true, tipo: 'email', autoComplete: 'email', inputMode: 'email' },
  { clave: 'celular', seccion: 'contacto', etiqueta: 'Celular', ayuda: 'Para coordinar la entrega', placeholder: null, visible: true, obligatorio: true, tipo: 'tel', autoComplete: 'tel-national', inputMode: 'tel' },
  { clave: 'nombre', seccion: 'contacto', etiqueta: 'Nombre y apellido', ayuda: null, placeholder: 'Ej.: Laura Pérez', visible: true, obligatorio: true, tipo: 'text', autoComplete: 'name', inputMode: 'text', exigirApellido: false },
  { clave: 'factura', seccion: 'contacto', etiqueta: 'Necesito factura a nombre de empresa', ayuda: 'Opcional · con NIT, cédula u otro documento', placeholder: null, visible: true, obligatorio: false, tipo: 'text', autoComplete: null, inputMode: null },
  { clave: 'direccion', seccion: 'entrega', etiqueta: 'Dirección', ayuda: 'Calle, carrera o avenida y número', placeholder: 'Ej.: Cra 7 # 45-12', visible: true, obligatorio: true, tipo: 'text', autoComplete: 'address-line1', inputMode: 'text' },
  { clave: 'complemento', seccion: 'entrega', etiqueta: 'Apto, casa u oficina (opcional)', ayuda: null, placeholder: 'Ej.: Apto 301', visible: true, obligatorio: false, tipo: 'text', autoComplete: 'address-line2', inputMode: 'text' },
  { clave: 'barrio', seccion: 'entrega', etiqueta: 'Barrio', ayuda: null, placeholder: 'Ej.: Chapinero', visible: true, obligatorio: false, tipo: 'text', autoComplete: 'address-level3', inputMode: 'text' },
  { clave: 'ciudad', seccion: 'entrega', etiqueta: 'Ciudad o municipio', ayuda: 'Escribe para buscar; si no aparece, escríbela completa', placeholder: 'Escribe para buscar', visible: true, obligatorio: true, tipo: 'text', autoComplete: 'address-level2', inputMode: 'text' },
  { clave: 'notas', seccion: 'entrega', etiqueta: 'Indicaciones para la entrega (opcional)', ayuda: null, placeholder: 'Ej.: el timbre no sirve, llamar al llegar', visible: true, obligatorio: false, tipo: 'text', autoComplete: null, inputMode: 'text' },
]

/** Lo que el ERP podrá cambiar de un campo (fase 2). */
export interface AjusteCampo {
  clave: ClaveCampo
  visible?: boolean
  obligatorio?: boolean
  etiqueta?: string
  ayuda?: string | null
  exigirApellido?: boolean
}

/** Campos que nunca se esconden ni dejan de ser obligatorios (con domicilio, los de la dirección). */
const SIEMPRE_OBLIGATORIOS: readonly ClaveCampo[] = ['nombre', 'direccion', 'ciudad']

/**
 * La lista del checkout: la por defecto con los ajustes del ERP encima (fase 2). Sin ajustes
 * (`null`, `undefined` o lista vacía) devuelve la por defecto tal cual: el checkout de la fase 1.
 * Un ajuste no puede esconder ni volver opcionales nombre, dirección o municipio, ni dejar la tienda
 * sin correo y sin celular.
 */
export function camposDelCheckout(ajustes?: readonly AjusteCampo[] | null): CampoCheckout[] {
  const porClave = new Map((ajustes ?? []).map((a) => [a.clave, a]))
  const lista = CAMPOS_CHECKOUT_POR_DEFECTO.map((c) => {
    const a = porClave.get(c.clave)
    if (!a) return { ...c }
    const fijo = SIEMPRE_OBLIGATORIOS.includes(c.clave)
    return {
      ...c,
      visible: fijo ? true : a.visible ?? c.visible,
      obligatorio: fijo ? true : a.obligatorio ?? c.obligatorio,
      etiqueta: a.etiqueta?.trim() ? a.etiqueta.trim() : c.etiqueta,
      ayuda: a.ayuda === undefined ? c.ayuda : a.ayuda,
      ...(c.clave === 'nombre' ? { exigirApellido: a.exigirApellido ?? c.exigirApellido } : {}),
    }
  })
  // Correo o celular: al menos uno visible y obligatorio.
  const email = lista.find((c) => c.clave === 'email')!
  const celular = lista.find((c) => c.clave === 'celular')!
  if (!(email.visible && email.obligatorio) && !(celular.visible && celular.obligatorio)) {
    email.visible = true
    email.obligatorio = true
  }
  return lista
}

/** El campo de una lista (siempre existe: la lista sale de la por defecto). */
export function campo(lista: readonly CampoCheckout[], clave: ClaveCampo): CampoCheckout {
  return lista.find((c) => c.clave === clave) ?? (CAMPOS_CHECKOUT_POR_DEFECTO.find((c) => c.clave === clave) as CampoCheckout)
}
