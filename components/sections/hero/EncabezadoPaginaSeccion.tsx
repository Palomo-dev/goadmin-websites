'use client'

/**
 * `hero` · `page_header` — «Encabezado de página» (Contacto v2, Figma 3105:84692, bloque 1).
 *
 * Migas «Inicio › <página>», título, texto, chips cortos y una imagen opcional a la derecha. Es una
 * variante de «Portada»: sirve en cualquier página interna. Las migas reutilizan `MigasTienda`
 * (las mismas del carrito y la ficha); el nombre de la página llega en `data.pageTitle`.
 */

import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MigasTienda } from '@/components/site/volver/EncabezadoPagina'
import { HeroButtons, type HeroButtonItem } from './HeroButtons'
import { CLAVES_ENCABEZADO_PAGINA } from '@/lib/website/v2/contrato/paginaContacto'

interface Props {
  content: Record<string, unknown>
  primaryColor?: string
  data?: Record<string, unknown>
}

function txt(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function imagenSegura(v: unknown): string | null {
  const u = txt(v)
  return /^(https:\/\/|\/(?!\/))/i.test(u) ? u : null
}

/** Chips: texto suelto o `{ text }`; máximo 4. */
export function chipsEncabezado(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? String((x as { text?: unknown }).text ?? '') : ''))
    .map((x) => x.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 4)
}

export function EncabezadoPaginaSeccion({ content, primaryColor = '#3B82F6', data }: Props) {
  const titulo = txt(content.title)
  const subtitulo = txt(content.subtitle)
  const conMigas = content.show_breadcrumb !== false
  const conTitulo = content.show_title !== false
  const pagina = txt(data?.pageTitle) || titulo
  const chips = chipsEncabezado(content.badges)
  const imagen = imagenSegura(content.image_url)
  const botones = Array.isArray(content.buttons) ? (content.buttons as HeroButtonItem[]) : undefined
  // Sin «Fondo» propio (Estilo de la sección): un tono suave del color de la tienda, como el diseño.
  const conTono = content.section_background == null

  return (
    <div
      className={cn('grid items-center gap-8 py-6 md:py-10', conTono && 'rounded-2xl px-6 md:px-10', imagen && 'md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]')}
      style={conTono ? { backgroundColor: `color-mix(in srgb, ${primaryColor} 7%, transparent)` } : undefined}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {conMigas && pagina && <MigasTienda migas={[{ etiqueta: 'Inicio', href: '/' }, { etiqueta: pagina }]} />}
        {conTitulo && titulo && (
          <h1 className="text-4xl font-bold leading-tight text-gray-900 dark:text-white md:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {titulo}
          </h1>
        )}
        {subtitulo && <p className="max-w-2xl text-lg text-gray-600 dark:text-gray-300">{subtitulo}</p>}
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <li key={`${i}-${c}`} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                {i === 0 ? (
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-600" />
                ) : (
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                )}
                {c}
              </li>
            ))}
          </ul>
        )}
        <HeroButtons
          buttons={botones}
          ctaText={txt(content.cta_text) || undefined}
          ctaUrl={txt(content.cta_url) || undefined}
          primaryColor={primaryColor}
          showCta={content.show_cta !== false}
          className="mt-2"
        />
      </div>
      {imagen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagen} alt="" loading="eager" className="aspect-[4/3] w-full rounded-2xl object-cover" />
      )}
    </div>
  )
}

EncabezadoPaginaSeccion.CONTENT_KEYS = CLAVES_ENCABEZADO_PAGINA
