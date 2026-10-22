/**
 * Dónde va el logo. `logo_position` ausente y composición centrada o dividida → centro.
 * Si la posición viene (aunque sea izquierda), manda ella: el render de hoy no se mueve.
 */

export type LadoLogo = 'left' | 'center' | 'right'

export interface AjustesLogo {
  logo_position?: string | null
  header_style?: string | null
  mobile_logo_position?: string | null
}

export function logoEfectivo(ajustes: AjustesLogo | null | undefined): LadoLogo {
  const pos = ajustes?.logo_position
  if (pos === 'left' || pos === 'center' || pos === 'right') return pos
  const estilo = ajustes?.header_style
  if (estilo === 'centered' || estilo === 'split') return 'center'
  return 'left'
}

/** `inherit` o ausente: el mismo lado que el computador. */
export function logoMovil(ajustes: AjustesLogo | null | undefined): LadoLogo {
  const movil = ajustes?.mobile_logo_position
  if (movil === 'left' || movil === 'center' || movil === 'right') return movil
  return logoEfectivo(ajustes)
}
