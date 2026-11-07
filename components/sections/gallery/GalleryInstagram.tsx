/**
 * Galería `gallery · instagram_cta` («Instagram», plantilla Contraste; PLANO §3).
 *
 * «Síguenos @usuario», una fila de hasta 5 fotos a alturas distintas y, en el medio, una tarjeta
 * con un llamado (`cta_title` + botón `cta_text` → `cta_url`).
 * - `handle` vacío = el usuario de Instagram de `social_links` del sitio. Sin ninguno, no se
 *   escribe usuario (nunca uno de ejemplo).
 * - Sin título ni botón, no hay tarjeta del llamado. Sin fotos no se pinta nada (en la vista
 *   previa, un aviso).
 * En el celular la fila se desliza de lado.
 *
 * Sin 'use client': el manifiesto lee `GalleryInstagram.CONTENT_KEYS`.
 */
import Link from 'next/link'
import { BOTON_PRIMARIO } from '@/lib/website/botonSitio'
import { CLAVES_SECCION_TIENDA, normalizarGaleriaInstagram } from '@/lib/website/v2/contrato/seccionesTienda'
import { posicionLlamadoInstagram, urlPerfilInstagram, usuarioInstagram } from '@/lib/website/portadaTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { rutaSede } from '../tienda/comunPortada'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['gallery.instagram_cta']

/** Alturas que se alternan en la fila (como en la lámina). */
const ALTURAS = ['h-40 md:h-44', 'h-48 md:h-56', 'h-56 md:h-72', 'h-44 md:h-52', 'h-48 md:h-60'] as const

interface Props {
  content: Record<string, unknown>
  organization?: { website_settings?: { social_links?: unknown; show_social_links?: unknown } | null } | null
  data?: Record<string, unknown>
}

export function GalleryInstagram({ content, organization, data }: Props) {
  const g = normalizarGaleriaInstagram(content)
  if (g.images.length === 0) {
    return <EditorHint title="Galería sin fotos">Agrega hasta 5 fotos de tu Instagram.</EditorHint>
  }
  // Las redes del sitio solo si el dueño las muestra (`show_social_links`), como en el pie.
  const ajustes = organization?.website_settings
  const usuario = g.handle || (ajustes?.show_social_links === false ? '' : usuarioInstagram(ajustes?.social_links))
  const perfil = usuario ? urlPerfilInstagram(usuario) : null
  const llamado = g.ctaTitle || (g.ctaText && g.ctaUrl) ? (
    <li key="llamado" className="flex h-64 w-60 shrink-0 snap-center items-center justify-center p-3 text-white md:h-72 md:w-64" style={{ backgroundColor: 'var(--text-color, #161616)' }}>
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 border border-white/25 p-5 text-center">
        {g.ctaTitle && <p className="text-2xl leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>{g.ctaTitle}</p>}
        {g.ctaText && g.ctaUrl && (
          <Link href={rutaSede(g.ctaUrl, data)} {...BOTON_PRIMARIO} className="bg-white px-5 py-2.5 text-xs font-semibold text-gray-900 transition-opacity hover:opacity-90">
            {g.ctaText}
          </Link>
        )}
      </div>
    </li>
  ) : null
  const corte = posicionLlamadoInstagram(g.images.length)
  const foto = (url: string, i: number) => (
    <li key={`${url}-${i}`} className={`w-36 shrink-0 snap-center overflow-hidden bg-black/5 md:w-44 ${ALTURAS[i % ALTURAS.length]}`}>
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    </li>
  )
  return (
    <div data-galeria="instagram_cta">
      {usuario && (
        <p className="mb-6 text-center text-sm">
          {perfil ? (
            <a href={perfil} target="_blank" rel="noopener noreferrer" className="hover:underline">Síguenos @{usuario}</a>
          ) : (
            <>Síguenos @{usuario}</>
          )}
        </p>
      )}
      <ul className="-mx-4 flex snap-x items-center gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:justify-center md:overflow-visible md:px-0">
        {g.images.slice(0, corte).map(foto)}
        {llamado}
        {g.images.slice(corte).map((url, i) => foto(url, i + corte))}
      </ul>
    </div>
  )
}

GalleryInstagram.CONTENT_KEYS = CONTENT_KEYS
