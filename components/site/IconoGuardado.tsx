'use client'

/**
 * Ícono guardado en una categoría o en un ítem del menú (`icon`), pintado como ícono: nunca el
 * nombre en texto («Smartphone», «Cctv»…), que es lo que salía en el menú «Categorías».
 *
 *  - URL → imagen decorativa (`alt=""`); si no carga, el respaldo (con `conRespaldo`) o nada.
 *  - Emoji → el emoji.
 *  - Nombre de lucide (tolerante a minúsculas y guiones) → el ícono; si no existe, el automático
 *    por el nombre de la categoría y, al final, «Tag» (`IconoCategoria`).
 *  - Vacío → nada, salvo `conRespaldo` (entonces el automático o «Tag»).
 */
import { useState } from 'react'
import { IconoCategoria } from '@/components/sections/products/IconoCategoria'
import { tipoIconoGuardado } from '@/lib/website/iconosCategoria'

export function IconoGuardado({
  icono,
  nombre,
  className = 'h-4 w-4',
  conRespaldo = false,
}: {
  icono: unknown
  /** Nombre de la categoría o del ítem: elige el ícono automático si el guardado no sirve. */
  nombre?: unknown
  className?: string
  conRespaldo?: boolean
}) {
  const t = tipoIconoGuardado(icono)
  const [imagenRota, setImagenRota] = useState(false)
  if (t.tipo === 'url' && imagenRota) {
    return conRespaldo ? <IconoCategoria cat={{ icon: null, name: nombre }} className={className} aria-hidden="true" /> : null
  }
  if (t.tipo === 'url') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={t.valor}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className={`${className} object-contain`}
        onError={() => setImagenRota(true)}
      />
    )
  }
  if (t.tipo === 'emoji') {
    return (
      <span aria-hidden="true" className="leading-none">
        {t.valor}
      </span>
    )
  }
  if (t.tipo === 'vacio' && !conRespaldo) return null
  return <IconoCategoria cat={{ icon: t.valor || null, name: nombre }} className={className} aria-hidden="true" />
}
