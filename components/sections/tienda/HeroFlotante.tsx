/**
 * Portada `hero · floating` («Tarjetas flotantes», plantilla Radiante; PLANO §3).
 *
 * Foto en tarjeta con margen, título con palabra resaltada (`title_highlight`), botones y, a la
 * derecha, hasta 3 tarjetas flotantes, en el orden del dueño y sin repetir:
 * - `categories`: chips de las categorías principales REALES (enlazan a `/categorias/<slug>`).
 *   Sin categorías no se pinta.
 * - `rating`: «4,9 de N reseñas» con las reseñas aprobadas REALES. Con 0 reseñas no se pinta.
 * - `video`: enlace al video del dueño (`video_url`); sin enlace no entra (lo filtra el contrato).
 *
 * Datos (precarga de `lib/queries/tienda/portada.ts`, solo si la sección está): `data.categories`
 * y `data.resumenResenas.product_reviews`.
 *
 * Sin 'use client': el manifiesto lee `HeroFlotante.CONTENT_KEYS`. `subtitle` es la clave de
 * siempre de las portadas (pedido a P0: sumarla a `CLAVES_SECCION_TIENDA['hero.floating']`).
 */
import Link from 'next/link'
import { ArrowUpRight, Play } from 'lucide-react'
import { CLAVES_SECCION_TIENDA, normalizarPortadaFlotante } from '@/lib/website/v2/contrato/seccionesTienda'
import { categoriasDePortada, partirResumen, textoResumenDe } from '@/lib/website/portadaTienda'
import { HeroButtons, type HeroButtonItem } from '../hero/HeroButtons'
import { acentoDe, partesTitulo, TituloConResaltado } from '../hero/TituloResaltado'
import { estiloSolapa, RADIO_PORTADA, rutaSede } from './comunPortada'

export const CONTENT_KEYS = [...CLAVES_SECCION_TIENDA['hero.floating'], 'subtitle'] as const

const MAX_CHIPS = 4

interface Props {
  content: Record<string, unknown>
  organization?: { name?: string; website_settings?: Record<string, unknown> | null } | null
  primaryColor?: string
  data?: Record<string, unknown>
}

export function HeroFlotante({ content, organization, primaryColor = '#111111', data }: Props) {
  const p = normalizarPortadaFlotante(content)
  const titulo = p.title || organization?.name || ''
  const subtitulo = typeof content.subtitle === 'string' ? content.subtitle.trim() : ''
  const partes = partesTitulo(titulo, p.titleHighlight)
  const categorias = categoriasDePortada(data, MAX_CHIPS)
  const resumen = textoResumenDe(data, 'product_reviews')
  // Van sobre la foto: el contorno y el enlace en blanco (con el primario no se leerían).
  const botones: HeroButtonItem[] = p.buttons.map((b) => {
    // `gradient` no existe en HeroButtons: se pinta como el sólido de siempre.
    const variant = b.variant === 'gradient' ? 'solid' : (b.variant as HeroButtonItem['variant'])
    const claro = variant === 'outline' || variant === 'link'
    return {
      label: b.label,
      url: rutaSede(b.url, data),
      variant,
      radius: 9999,
      size: 'md',
      full_width_mobile: false,
      ...(claro ? { bg_color: '#FFFFFF', text_color: '#FFFFFF' } : {}),
    }
  })

  const tarjetas = p.floatingCards.map((t) => {
    if (t.kind === 'categories') {
      if (categorias.length === 0) return null
      return (
        <ul key="categories" className="flex flex-wrap justify-start gap-2 md:justify-end">
          {categorias.map((c) => (
            <li key={c.id}>
              <Link
                href={rutaSede(`/categorias/${encodeURIComponent(c.slug)}`, data)}
                className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                {c.name}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )
    }
    if (t.kind === 'rating') {
      if (!resumen) return null
      const { cifra, resto } = partirResumen(resumen)
      return (
        <div key="rating" className="rounded-[20px] border border-white/30 bg-white/15 p-5 text-white backdrop-blur">
          <p className="text-5xl leading-none" style={{ fontFamily: 'var(--font-heading)' }}>{cifra}</p>
          <p className="mt-2 text-sm opacity-85">{resto}</p>
        </div>
      )
    }
    return (
      <a
        key="video"
        href={t.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-[20px] bg-white p-3 pr-5 text-gray-900 shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100">
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        </span>
        <span className="text-base" style={{ fontFamily: 'var(--font-heading)' }}>Ver el video</span>
      </a>
    )
  }).filter(Boolean)

  return (
    <div className="p-2 md:p-3" data-portada-tienda="floating">
      <div
        className="relative flex min-h-[560px] overflow-hidden text-white md:min-h-[600px]"
        style={{ borderRadius: RADIO_PORTADA, backgroundColor: p.imageUrl ? undefined : primaryColor, ...estiloSolapa(organization, content) }}
      >
        {p.imageUrl && <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-black/10" />
        <div className="relative z-10 grid w-full items-end gap-8 px-5 py-10 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:px-12 md:py-14">
          <div>
            {titulo && (
              <h1 className="text-4xl leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl" style={{ fontFamily: 'var(--font-heading)' }}>
                {partes ? <TituloConResaltado partes={partes} estilo={p.titleHighlight.style} acento={acentoDe(organization, primaryColor)} /> : titulo}
              </h1>
            )}
            {subtitulo && <p className="mt-5 max-w-xl text-base opacity-90 md:text-lg">{subtitulo}</p>}
            {botones.length > 0 && <HeroButtons buttons={botones} primaryColor={primaryColor} className="mt-8" />}
          </div>
          {tarjetas.length > 0 && (
            <div className="flex w-full flex-col gap-3 md:ml-auto md:max-w-sm">{tarjetas}</div>
          )}
        </div>
      </div>
    </div>
  )
}

HeroFlotante.CONTENT_KEYS = CONTENT_KEYS
