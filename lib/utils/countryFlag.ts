/**
 * Mapeo de códigos ISO-3 (alfa-3) a ISO-2 (alfa-2) para los países en la BD.
 * Tomar los primeros 2 caracteres del alpha-3 no siempre produce el alpha-2 correcto
 * (ej: CHL → CH en lugar de CL), por eso usamos un mapa explícito.
 */
const ISO3_TO_ISO2: Record<string, string> = {
  AUS: 'AU',
  BRA: 'BR',
  CAN: 'CA',
  CHL: 'CL',
  COL: 'CO',
  ESP: 'ES',
  USA: 'US',
  JPN: 'JP',
  MEX: 'MX',
  GBR: 'GB',
}

/**
 * Convierte un código ISO de país (ej: "COL", "US") a su bandera emoji.
 * Soporta códigos alfa-2 (2 letras) y alfa-3 (3 letras).
 */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length < 2) return ''
  let alpha2: string
  if (code.length === 3) {
    alpha2 = ISO3_TO_ISO2[code.toUpperCase()] || code.substring(0, 2)
  } else {
    alpha2 = code
  }
  if (alpha2.length !== 2) return ''
  const codePoints = alpha2.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}
