/**
 * Palabra resaltada del título de la portada (`title_highlight` + `title_highlight_style`, PLANO
 * §2 ítem 21). La usan las portadas nuevas y HeroFullscreen, SOLO cuando la clave existe y la
 * palabra está en el título (`partirTituloResaltado`); si no, quien llama pinta su título de hoy.
 *
 * - `pill`: la palabra sobre una píldora del acento del sitio (`--accent-color`, con el primario de
 *   respaldo), con el texto en negro o blanco según el acento (`textoSobreAcentoSiHex`, la misma
 *   regla del editor).
 * - `underline`: subrayado grueso del acento.
 */
import { partirTituloResaltado, type TituloResaltado } from '@/lib/website/v2/contrato/seccionesTienda'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

const ACENTO = 'var(--accent-color, var(--primary-color))'

/** Partes del título, o `null` si no hay nada que resaltar (el título se pinta como hoy). */
export function partesTitulo(titulo: string, resaltado: TituloResaltado) {
  return resaltado.highlight ? partirTituloResaltado(titulo, resaltado.highlight) : null
}

/** Acento del sitio en hex (el mismo que pinta `--accent-color`), si se conoce. */
export function acentoDe(organization: unknown, primaryColor?: string): string | undefined {
  const ajustes = (organization as { website_settings?: { accent_color?: unknown } | null } | null)?.website_settings
  const acento = typeof ajustes?.accent_color === 'string' && ajustes.accent_color ? ajustes.accent_color : primaryColor
  return acento || undefined
}

export function TituloConResaltado({
  partes,
  estilo,
  acento,
}: {
  partes: { antes: string; resaltado: string; despues: string }
  estilo: TituloResaltado['style']
  acento?: string
}) {
  const marca =
    estilo === 'underline' ? (
      <span
        className="underline decoration-[0.09em] underline-offset-[0.14em]"
        style={{ textDecorationColor: ACENTO }}
        data-titulo-resaltado="underline"
      >
        {partes.resaltado}
      </span>
    ) : (
      <span
        className="inline-block rounded-full px-[0.28em] pb-[0.06em] leading-[1.05]"
        style={{ backgroundColor: ACENTO, color: textoSobreAcentoSiHex(acento) ?? undefined }}
        data-titulo-resaltado="pill"
      >
        {partes.resaltado}
      </span>
    )
  return (
    <>
      {partes.antes}
      {marca}
      {partes.despues}
    </>
  )
}
