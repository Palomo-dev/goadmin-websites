/**
 * Grupo «Ayuda» de Mi cuenta (Figma «16 Sitio web» 3044:78726): el WhatsApp del sitio
 * (`whatsapp_number` de los ajustes) y la primera página legal del pie. Sin ellos, la fila no se
 * pinta. Sin consultas: todo sale del contexto de la organización ya cargado.
 */
import { enlaceWhatsapp } from '@/lib/website/ajustesSitio'
import { enlacePoliticas, type PaginaNavCuenta } from '@/lib/cuenta/reglasCuenta'

export interface AyudaCuenta {
  whatsapp: { href: string; telefono: string } | null
  politicas: string | null
}

/** «300 123 4567» (los 10 dígitos de un celular de Colombia); otros números tal como vienen. */
export function telefonoLegible(numero: string): string {
  let d = numero.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2)
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : numero.trim()
}

export function ayudaCuenta(ajustes: unknown, paginasPie: readonly PaginaNavCuenta[] | null | undefined): AyudaCuenta {
  const a = ajustes && typeof ajustes === 'object' ? (ajustes as Record<string, unknown>) : {}
  const numero = typeof a.whatsapp_number === 'string' ? a.whatsapp_number : ''
  const whatsapp =
    numero.replace(/\D/g, '').length >= 7
      ? { href: enlaceWhatsapp({ numero, saludo: 'Hola, tengo una pregunta sobre mi cuenta en la tienda.' }), telefono: telefonoLegible(numero) }
      : null
  return { whatsapp, politicas: enlacePoliticas(paginasPie) }
}
