/**
 * Teléfono del cliente para el checkout de Wompi, que lo pide en dos partes:
 * `phone-number-prefix` («+57», con +) y `phone-number` («3001234567», solo dígitos).
 * Puro: lo prueba scripts/verify-telefono-wompi.mjs.
 */
export interface TelefonoWompi {
  prefijo: string
  numero: string
}

export function separarTelefonoWompi(crudo: string | null | undefined): TelefonoWompi {
  const rawPhone = (crudo || '').trim()
  let phoneNumber = ''
  let phonePrefix = ''
  if (rawPhone) {
    const phoneMatch = rawPhone.match(/^(\+\d{1,4})\s?(\d[\d\s]*)$/)
    if (phoneMatch) {
      phonePrefix = phoneMatch[1] // ej: "+57"
      phoneNumber = phoneMatch[2].replace(/\D/g, '') // ej: "3001234567"
    } else {
      // Sin prefijo: asumir Colombia (+57) si el número tiene 10 dígitos
      const digits = rawPhone.replace(/\D/g, '')
      if (digits.length === 10) {
        phonePrefix = '+57'
        phoneNumber = digits
      } else if (digits.length > 10) {
        // Probablemente incluye el código de país: los últimos 10 son el número
        phonePrefix = `+${digits.slice(0, -10)}`
        phoneNumber = digits.slice(-10)
      } else {
        phoneNumber = digits
      }
    }
  }
  return { prefijo: phonePrefix, numero: phoneNumber }
}
