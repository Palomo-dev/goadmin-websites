/**
 * Teléfono del cliente para el checkout de Wompi, que lo pide en dos partes:
 * `phone-number-prefix` («+57», con +) y `phone-number` («3001234567», solo dígitos).
 * Puro: lo prueba scripts/verify-telefono-wompi.mjs.
 *
 * Antes la regex `^(\+\d{1,4})\s?(…)` era codiciosa: con el indicativo pegado («+573105407613»,
 * como lo guarda el checkout) tomaba «+5731» de prefijo y «05407613» de número, y Wompi abría
 * el formulario con el teléfono mal (QA 4-nov, org 338).
 */
export interface TelefonoWompi {
  prefijo: string
  numero: string
}

export function separarTelefonoWompi(crudo: string | null | undefined): TelefonoWompi {
  const rawPhone = (crudo || '').trim()
  if (!rawPhone) return { prefijo: '', numero: '' }

  // Indicativo separado del número («+57 300…», «+57-300…»): se respeta tal cual.
  const conSeparador = rawPhone.match(/^\+(\d{1,4})[\s-]+(\d[\d\s-]*)$/)
  if (conSeparador) {
    return { prefijo: `+${conSeparador[1]}`, numero: conSeparador[2].replace(/\D/g, '') }
  }

  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length === 10) {
    // Sin indicativo: Colombia (+57), como antes.
    return { prefijo: '+57', numero: digits }
  } else if (digits.length > 10) {
    // Indicativo pegado («+573105407613» o «573105407613»): los últimos 10 dígitos son el número.
    return { prefijo: `+${digits.slice(0, -10)}`, numero: digits.slice(-10) }
  } else {
    // Menos de 10 dígitos: sin prefijo, como antes.
    return { prefijo: '', numero: digits }
  }
}
