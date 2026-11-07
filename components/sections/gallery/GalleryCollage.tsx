/**
 * Galería `gallery · collage` («Collage», plantilla Radiante; PLANO §3).
 *
 * Hasta 3 fotos sueltas alrededor de una frase centrada en la letra de los títulos. En el celular
 * las fotos van en fila sobre la frase. Sin fotos ni frase no se pinta nada (en la vista previa del
 * editor, un aviso).
 *
 * Sin 'use client': el manifiesto lee `GalleryCollage.CONTENT_KEYS`.
 */
import { CLAVES_SECCION_TIENDA, normalizarGaleriaCollage } from '@/lib/website/v2/contrato/seccionesTienda'
import { EditorHint } from '../restaurant/EditorHint'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['gallery.collage']

/** Posición de cada foto en escritorio (izquierda baja, centro alta girada, derecha alta). */
const POSICIONES = [
  'md:absolute md:left-[6%] md:top-[30%] md:w-[18%] md:aspect-[4/5]',
  'md:absolute md:left-[40%] md:top-0 md:w-[12%] md:aspect-[4/4.2] md:rotate-6',
  'md:absolute md:right-[4%] md:top-[6%] md:w-[26%] md:aspect-[16/10]',
] as const

export function GalleryCollage({ content }: { content: Record<string, unknown> }) {
  const g = normalizarGaleriaCollage(content)
  if (g.images.length === 0 && !g.phrase) {
    return <EditorHint title="Collage sin fotos">Agrega hasta 3 fotos y una frase.</EditorHint>
  }
  const radio = { borderRadius: 'calc(var(--radio-sitio, 12px) * 1.25)' }
  return (
    <div className="relative md:min-h-[440px]" data-galeria="collage">
      <div className="mb-8 grid grid-cols-3 gap-3 md:mb-0 md:block">
        {g.images.map((url, i) => (
          <div key={`${url}-${i}`} className={`aspect-[4/5] overflow-hidden bg-black/5 shadow-sm ${POSICIONES[i]}`} style={radio}>
            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
      {g.phrase && (
        <p
          className="relative z-10 mx-auto max-w-md text-center text-3xl leading-tight md:absolute md:inset-x-0 md:top-1/2 md:-translate-y-1/4 md:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {g.phrase}
        </p>
      )}
    </div>
  )
}

GalleryCollage.CONTENT_KEYS = CONTENT_KEYS
