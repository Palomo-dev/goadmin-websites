'use client'

/**
 * Vista cliente de `gallery_bento` (Figma 148:7362 / 148:7562).
 *
 * Movimiento (nota 149:8283): fade-up escalonado; zoom 1.05 y pie de foto en
 * hover (solo con puntero que hace hover); lightbox con trampa de foco, Esc y
 * flechas. prefers-reduced-motion: sin zoom ni fade.
 */

import { useRef, useState } from 'react'
import { Instagram } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiteImage } from './SiteImage'
import { SectionHeading } from './SectionHeading'
import { useSectionMotion } from './useSectionMotion'
import m from './motion.module.css'
import { Lightbox } from '@/components/site/LightboxFotos'

export type { BentoImage } from '@/components/site/LightboxFotos'
import type { BentoImage } from '@/components/site/LightboxFotos'

interface GalleryBentoViewProps {
  eyebrow: string | null
  title: string | null
  subtitle: string | null
  images: BentoImage[]
  instagramHandle: string | null
  instagramUrl: string | null
  /** Radio de las fotos (CARD_FIELDS del editor). */
  mediaStyle: React.CSSProperties
}

/** Posición de cada foto dentro de su bloque de 4 (móvil · escritorio). */
const SLOTS = [
  'col-span-2 h-40 md:col-span-1 md:row-span-2 md:h-auto',
  'row-span-2 h-auto md:row-span-1',
  'h-40 md:row-span-2 md:h-auto',
  'h-40 md:col-start-2 md:h-auto',
]
const SIZES = ['(min-width: 768px) 50vw, 100vw', '(min-width: 768px) 25vw, 50vw', '(min-width: 768px) 25vw, 50vw', '(min-width: 768px) 25vw, 50vw']

export function GalleryBentoView(props: GalleryBentoViewProps) {
  const { ref, motionProps } = useSectionMotion<HTMLDivElement>()
  const [open, setOpen] = useState<number | null>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)

  const blocks: BentoImage[][] = []
  for (let i = 0; i < props.images.length; i += 4) blocks.push(props.images.slice(i, i + 4))

  return (
    <div ref={ref} {...motionProps} className="flex flex-col gap-8">
      <SectionHeading
        eyebrow={props.eyebrow}
        title={props.title}
        subtitle={props.subtitle}
        aside={
          props.instagramHandle && props.instagramUrl ? (
            <a
              href={props.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden shrink-0 items-center gap-1.5 text-sm leading-5 text-muted-foreground hover:text-foreground md:flex"
            >
              <Instagram className="h-[18px] w-[18px]" aria-hidden="true" />
              {props.instagramHandle}
            </a>
          ) : null
        }
      />
      <div className="flex flex-col gap-4">
        {blocks.map((block, b) => (
          <ul
            key={b}
            className="grid grid-cols-2 grid-rows-[160px_160px_160px] gap-4 md:h-[536px] md:grid-cols-[minmax(0,632fr)_minmax(0,308fr)_minmax(0,308fr)] md:grid-rows-2"
          >
            {block.map((img, i) => {
              const index = b * 4 + i
              return (
                <li key={index} className={cn('min-h-0', SLOTS[i], m.fadeUp)} style={{ '--i': i } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={(e) => {
                      openerRef.current = e.currentTarget
                      setOpen(index)
                    }}
                    className={cn(
                      'relative block h-full w-full overflow-hidden rounded-xl bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                      m.zoomHost,
                      m.captionHost,
                    )}
                    style={{ ...props.mediaStyle, outlineColor: 'var(--primary-color)' }}
                    aria-label={`Ampliar foto${img.caption ? `: ${img.caption}` : img.alt ? `: ${img.alt}` : ` ${index + 1}`}`}
                  >
                    <span className={cn('absolute inset-0', m.zoomImg)}>
                      <SiteImage src={img.url} alt={img.alt} sizes={SIZES[i]} />
                    </span>
                    {img.caption && (
                      <span className={cn('absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded-md bg-black/50 px-3 py-2 text-sm leading-5 text-white', m.caption)}>
                        {img.caption}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        ))}
      </div>
      {props.instagramHandle && props.instagramUrl && (
        <a
          href={props.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 self-start text-sm leading-5 text-muted-foreground hover:text-foreground md:hidden"
        >
          <Instagram className="h-[18px] w-[18px]" aria-hidden="true" />
          {props.instagramHandle}
        </a>
      )}
      {open !== null && (
        <Lightbox
          images={props.images}
          index={open}
          onIndex={setOpen}
          onClose={() => {
            setOpen(null)
            openerRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
