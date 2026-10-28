/**
 * «Diseño de celular por debajo de» (mobile_breakpoint): el ancho lo decide SiteHeader con JS, pero
 * las variantes traen clases `md:` fijas (768). Con otro breakpoint, este CSS acotado al envoltorio
 * hace que lo que muestra/oculta `md:` siga al breakpoint elegido. Con 768 (lo de hoy) no hay CSS
 * ni envoltorio: el árbol queda igual.
 */
export const BREAKPOINT_HEADER_HOY = 768

export type ModoBreakpoint = 'movil' | 'escritorio'

const DISPLAYS = ['flex', 'block', 'inline-flex', 'grid', 'inline-block'] as const

export function cssBreakpointHeader(breakpoint: number, modo: ModoBreakpoint): string | null {
  if (breakpoint === BREAKPOINT_HEADER_HOY) return null
  const s = `[data-hdr-bp="${modo}"]`
  const reglas: string[] = []
  if (modo === 'movil') {
    // Celular elegido aunque el ancho sea ≥768: lo `md:hidden` se ve y lo `hidden md:*` no.
    reglas.push(`${s} .md\\:hidden:not(.hidden){display:block}`)
    for (const d of DISPLAYS) reglas.push(`${s} .${d}.md\\:hidden:not(.hidden){display:${d}}`)
    reglas.push(`${s} ${DISPLAYS.map((d) => `.hidden.md\\:${d}`).join(',' + s + ' ')}{display:none}`)
  } else {
    // Computador elegido aunque el ancho sea <768: lo `hidden md:*` se ve y lo `md:hidden` no.
    for (const d of DISPLAYS) reglas.push(`${s} .hidden.md\\:${d}{display:${d}}`)
    reglas.push(`${s} .md\\:hidden{display:none}`)
    // Computador por debajo de 768 (breakpoint 640): las filas de escritorio fueron pensadas para
    // ≥768. El menú cede ancho y se desliza en vez de empujar los íconos fuera de la pantalla.
    if (breakpoint < BREAKPOINT_HEADER_HOY) {
      reglas.push(
        `@media (max-width:${BREAKPOINT_HEADER_HOY - 0.02}px){${s} header nav,${s} header .flex-1{min-width:0}` +
          `${s} header nav{overflow-x:auto;scrollbar-width:none}${s} header nav>*{flex-shrink:0}}`,
      )
    }
  }
  return reglas.join('\n')
}
