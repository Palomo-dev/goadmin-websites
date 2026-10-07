'use client'

/**
 * Foto ampliada en un diálogo: trampa de foco, Esc, flechas ← → y contador. Nació en la galería
 * bento (Figma 148:7362, nota 149:8283) y lo comparten las galerías con «Lightbox al hacer clic».
 * Se movió aquí sin cambios desde `GalleryBentoView.tsx`.
 */

import { useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiteImage } from '@/components/sections/restaurant/SiteImage'

export interface BentoImage {
  url: string
  alt: string
  caption: string | null
}

export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: BentoImage[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const img = images[index]
  const many = images.length > 1
  const go = useCallback((delta: number) => onIndex((index + delta + images.length) % images.length), [index, images.length, onIndex])

  useEffect(() => {
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowRight' && many) {
      go(1)
    } else if (e.key === 'ArrowLeft' && many) {
      go(-1)
    } else if (e.key === 'Tab') {
      // Trampa de foco: el Tab da la vuelta dentro del diálogo.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button')
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const btn = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={img.caption || img.alt || 'Foto ampliada'}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-12"
    >
      <button ref={closeRef} type="button" onClick={onClose} className={cn(btn, 'absolute right-4 top-4')} aria-label="Cerrar">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {many && (
        <button type="button" onClick={() => go(-1)} className={cn(btn, 'absolute left-4 top-1/2 -translate-y-1/2')} aria-label="Foto anterior">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <figure className="flex max-h-full w-full max-w-5xl flex-col items-center gap-3">
        <div className="relative h-[70vh] w-full">
          <SiteImage src={img.url} alt={img.alt} sizes="100vw" className="!object-contain" />
        </div>
        {(img.caption || many) && (
          <figcaption className="text-center text-sm leading-5 text-white/85">
            {img.caption}
            {many && <span className="ml-2 text-white/60">{`${index + 1} / ${images.length}`}</span>}
          </figcaption>
        )}
      </figure>
      {many && (
        <button type="button" onClick={() => go(1)} className={cn(btn, 'absolute right-4 top-1/2 -translate-y-1/2')} aria-label="Foto siguiente">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
