'use client'

/**
 * «Lightbox al hacer clic» (`lightbox`) de las galerías: la foto se abre ampliada en el mismo
 * diálogo de la galería bento (Figma 148:7362): trampa de foco, Esc, flechas ← →, y el foco
 * vuelve a la foto al cerrar. Todo en el cliente, sin consultas.
 */

import { useRef, useState } from 'react'
import { Lightbox, type BentoImage } from '@/components/site/LightboxFotos'
import { booleano } from '@/lib/carrusel/opcionesCarrusel'

/** Las galerías no abrían la foto: con la clave ausente se mantiene así. */
export function lightboxActivo(content: Record<string, unknown> | null | undefined): boolean {
  return booleano(content?.lightbox, false)
}

export function aFotosLightbox(imagenes: any[]): BentoImage[] {
  return imagenes.map((img, i) =>
    typeof img === 'string'
      ? { url: img, alt: `Imagen ${i + 1}`, caption: null }
      : { url: img?.url ?? '', alt: img?.alt || `Imagen ${i + 1}`, caption: img?.caption || null },
  )
}

export function etiquetaAmpliar(foto: BentoImage, i: number): string {
  return `Ampliar foto${foto.caption ? `: ${foto.caption}` : foto.alt ? `: ${foto.alt}` : ` ${i + 1}`}`
}

export const FOCO_FOTO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white'

/** Estado del lightbox: `abrir(i, boton)` y el diálogo a pintar. */
export function useLightbox(fotos: BentoImage[]) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const abrir = (i: number, el: HTMLElement | null) => {
    opener.current = el
    setAbierta(i)
  }
  const dialogo =
    abierta !== null && fotos[abierta] ? (
      <Lightbox
        images={fotos}
        index={abierta}
        onIndex={setAbierta}
        onClose={() => {
          setAbierta(null)
          opener.current?.focus()
        }}
      />
    ) : null
  return { abrir, dialogo, abierta }
}

/**
 * Cuadrícula de fotos que se amplían (galería «Cuadrícula» y «Mosaico» con el interruptor on).
 * Recibe las clases del componente para pintar lo mismo, con cada foto dentro de un botón.
 */
export function CuadriculaAmpliable({
  imagenes,
  contenedor,
  item,
  imagen,
}: {
  imagenes: any[]
  contenedor: string
  item: string
  imagen: string
}) {
  const fotos = aFotosLightbox(imagenes)
  const { abrir, dialogo } = useLightbox(fotos)
  return (
    <>
      <div className={contenedor} data-lightbox="">
        {fotos.map((f, i) => (
          <div key={i} className={item}>
            <button type="button" onClick={(e) => abrir(i, e.currentTarget)} aria-label={etiquetaAmpliar(f, i)} className={`block w-full h-full cursor-zoom-in ${FOCO_FOTO}`}>
              <img src={f.url} alt={f.alt} className={imagen} loading="lazy" />
            </button>
          </div>
        ))}
      </div>
      {dialogo}
    </>
  )
}
