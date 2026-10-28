/**
 * TEXTBL-04: «Alineación» (`alignment`) del bloque de texto. Sin clave, cada variante alinea como
 * hoy (centrado o izquierda). Con clave manda la alineación elegida, en computador y celular.
 */
export type Alineacion = 'left' | 'center' | 'right' | 'justify'
export function alineacionDe(content: unknown): Alineacion | null {
  const v = (content as { alignment?: unknown } | null | undefined)?.alignment
  return v === 'left' || v === 'center' || v === 'right' || v === 'justify' ? v : null
}
const TEXTO: Record<Alineacion, string> = { left: '!text-left', center: '!text-center', right: '!text-right', justify: '!text-justify' }
const DIVISOR: Record<Alineacion, string> = { left: '!ml-0 !mr-auto', center: '!mx-auto', right: '!ml-auto !mr-0', justify: '!ml-0 !mr-auto' }
export function claseAlineacion(content: unknown): string {
  const a = alineacionDe(content)
  return a ? TEXTO[a] : ''
}
export function claseDivisor(content: unknown): string {
  const a = alineacionDe(content)
  return a ? DIVISOR[a] : ''
}
