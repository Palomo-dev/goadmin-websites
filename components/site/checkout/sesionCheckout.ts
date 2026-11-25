/**
 * Datos de la cuenta en el checkout (`/api/customer/me`): cómo se juntan con lo que ya hay en el
 * formulario. Puro: CheckoutWizard y scripts/verify-checkout-v2.mjs.
 *
 * - Al abrir el checkout con sesión (`trasIngreso = false`): lo de siempre. La cuenta manda en
 *   nombre, correo, celular, dirección y ciudad, y la dirección por defecto se pone encima.
 * - Al entrar desde la ventana de acceso SIN salir del pago (`trasIngreso = true`): lo que el
 *   cliente ya escribió se respeta; la cuenta solo llena lo vacío. La dirección por defecto solo
 *   entra si no había dirección escrita (las guardadas quedan en la lista para elegir).
 */

export interface DatosCuentaCheckout {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
}

export interface DireccionCuentaCheckout {
  address_line1?: string | null
  city?: string | null
  country_code?: string | null
  department?: string | null
  is_default?: boolean | null
}

type Formulario = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  countryCode?: string
  stateName?: string
  department?: string
}

const vacio = (v: unknown) => typeof v !== 'string' || v.trim() === ''

/** Dirección que se pone en el formulario: la marcada por defecto o la primera. */
export function direccionPorDefecto<D extends DireccionCuentaCheckout>(direcciones: readonly D[] | null | undefined): D | null {
  if (!direcciones || direcciones.length === 0) return null
  return direcciones.find((a) => a.is_default) ?? direcciones[0] ?? null
}

export function mezclarDatosCuenta<F extends Formulario>(
  prev: F,
  datos: DatosCuentaCheckout,
  direcciones: readonly DireccionCuentaCheckout[] | null | undefined,
  trasIngreso: boolean,
): F {
  const elegir = (actual: string, cuenta: string | null | undefined) => {
    if (trasIngreso) return vacio(actual) ? cuenta || actual : actual
    return cuenta || actual
  }
  let r: F = {
    ...prev,
    firstName: elegir(prev.firstName, datos.firstName),
    lastName: elegir(prev.lastName, datos.lastName),
    email: elegir(prev.email, datos.email),
    phone: elegir(prev.phone, datos.phone),
    address: elegir(prev.address, datos.address),
    city: elegir(prev.city, datos.city),
  }
  const d = direccionPorDefecto(direcciones)
  if (d && (!trasIngreso || vacio(prev.address))) {
    r = {
      ...r,
      address: d.address_line1 || r.address,
      city: d.city || r.city,
      countryCode: d.country_code || r.countryCode,
      stateName: d.department || r.stateName,
      department: d.department || r.department,
    }
  } else {
    // Ya había dirección escrita (tras entrar): se respeta; las guardadas quedan para elegir.
  }
  return r
}
