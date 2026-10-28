import { HeroButtons, type HeroButtonItem } from '../hero/HeroButtons'

/**
 * CTA-06: «Botones adicionales» (`content.buttons`) del CTA, debajo o al lado del botón principal.
 * Sin la clave o vacía no pinta nada: los CTA publicados se ven como hoy.
 */
export function BotonesAdicionales({ buttons, primaryColor, className = '' }: { buttons?: unknown; primaryColor: string; className?: string }) {
  const lista = Array.isArray(buttons)
    ? (buttons as HeroButtonItem[]).filter((b) => b && typeof b === 'object' && typeof b.label === 'string' && b.label.trim() !== '' && typeof b.url === 'string' && b.url !== '')
    : []
  if (lista.length === 0) return null
  return <HeroButtons buttons={lista} primaryColor={primaryColor} className={className} />
}
