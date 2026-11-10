/**
 * `image_text · color_block` («Bloque de color», plantilla Marea; PLANO §3).
 *
 * Un bloque de color con número («01»), un título grande, una frase y un enlace a la colección,
 * con la foto al lado. «Plantilla completa» arma hasta 5 (`MAX_BLOQUES_COLOR`), uno por categoría
 * real con su `categories.color` y su foto.
 * - `bg_color` vacío = el primario del tema; `text_color` vacío = negro o blanco según el fondo
 *   (la misma regla del editor).
 * - Sin título ni foto no se pinta nada (en la vista previa, un aviso).
 *
 * El bloque llena el ancho de su sección: para que vaya de borde a borde, la sección lleva las
 * claves de siempre `full_bleed: true`, `padding_top`/`padding_bottom`/`padding_x: 'none'` (lo pone «Plantilla
 * completa»).
 *
 * Repetidor (decisión del dueño 2026-11-10: UNA sección con bloques que se repiten): con `blocks`
 * (cada uno con las mismas claves del bloque único; máximo 5) se pintan los bloques lado a lado.
 * Sin `blocks`, o sin ninguno con título o foto, el bloque único de siempre, sin cambios.
 *
 * Sin 'use client': el manifiesto lee `ImageTextColor.CONTENT_KEYS`.
 */
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { CLAVES_SECCION_TIENDA, normalizarBloqueColor, type BloqueColor } from '@/lib/website/v2/contrato/seccionesTienda'
import { CLAVE_BLOQUES_COLOR, bloquesColor, columnasBloquesColor } from '@/lib/website/opcionesEditorTienda'
import { EditorHint } from '../restaurant/EditorHint'
import { rutaSede } from '../tienda/comunPortada'

/** Las del bloque único (contrato) más el repetidor `blocks` (decisión 2026-11-10). */
export const CONTENT_KEYS = [...CLAVES_SECCION_TIENDA['image_text.color_block'], CLAVE_BLOQUES_COLOR]

interface Props {
  content: Record<string, unknown>
  primaryColor?: string
  data?: Record<string, unknown>
}

/** Un bloque dentro del repetidor: número, título, frase y enlace arriba; la foto abajo. */
function BloqueEnFila({ b, primaryColor, data }: { b: BloqueColor; primaryColor: string; data?: Record<string, unknown> }) {
  const fondo = b.bgColor || primaryColor
  const texto = b.textColor || textoSobreAcentoSiHex(fondo) || '#FFFFFF'
  return (
    <div className="flex min-w-0 flex-col gap-6 px-5 py-8 md:px-8 md:py-10" style={{ backgroundColor: fondo, color: texto }} data-bloque-color="">
      {b.number && <p className="text-xs font-semibold tracking-[0.12em]">{b.number}</p>}
      <div>
        {b.title && (
          <h2 className="break-words text-4xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em] md:text-5xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {b.title}
          </h2>
        )}
        {b.phrase && <p className="mt-3 max-w-sm text-sm opacity-90 md:text-base">{b.phrase}</p>}
        {b.ctaUrl && (
          <Link href={rutaSede(b.ctaUrl, data)} className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4 hover:decoration-2">
            Ver la colección
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {b.imageUrl && (
        <div className="mt-auto aspect-[4/5] overflow-hidden">
          <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
    </div>
  )
}

export function ImageTextColor({ content, primaryColor = '#111111', data }: Props) {
  const bloques = bloquesColor(content)
  if (bloques.length > 0) {
    return (
      <div className={`grid ${columnasBloquesColor(bloques.length)}`} data-bloques-color={bloques.length}>
        {bloques.map((b, i) => (
          <BloqueEnFila key={i} b={b} primaryColor={primaryColor} data={data} />
        ))}
      </div>
    )
  }
  // Sin repetidor: el bloque único de siempre.
  const b = normalizarBloqueColor(content)
  if (!b.title && !b.imageUrl) {
    return <EditorHint title="Bloque sin contenido">Agrega un título o una foto.</EditorHint>
  }
  const fondo = b.bgColor || primaryColor
  const texto = b.textColor || textoSobreAcentoSiHex(fondo) || '#FFFFFF'
  return (
    <div className="grid gap-8 px-5 py-10 md:grid-cols-2 md:gap-12 md:px-10 md:py-14" style={{ backgroundColor: fondo, color: texto }} data-bloque-color="">
      <div className="flex min-h-[260px] flex-col md:min-h-[420px]">
        {b.number && <p className="text-xs font-semibold tracking-[0.12em]">{b.number}</p>}
        <div className="my-auto py-8">
          {b.title && (
            <h2 className="break-words text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.03em] md:text-7xl lg:text-8xl" style={{ fontFamily: 'var(--font-heading)' }}>
              {b.title}
            </h2>
          )}
          {b.phrase && <p className="mt-4 max-w-sm text-base opacity-90">{b.phrase}</p>}
        </div>
        {b.ctaUrl && (
          <Link href={rutaSede(b.ctaUrl, data)} className="inline-flex items-center gap-1 self-start text-sm font-medium underline underline-offset-4 hover:decoration-2">
            Ver la colección
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {b.imageUrl && (
        <div className="aspect-[4/5] overflow-hidden md:aspect-auto md:min-h-[420px]">
          <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
    </div>
  )
}

ImageTextColor.CONTENT_KEYS = CONTENT_KEYS
