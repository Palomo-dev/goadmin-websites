import type { CSSProperties } from 'react'
import Link from 'next/link'
import {
  CLASE_PESO,
  CLASE_TAM_TITULO,
  type EncabezadoSeccion as Encabezado,
} from '@/lib/website/cascaronSeccion'

/**
 * Título de la sección cuando hay `section_header`. Sin ese objeto no se monta
 * y cada sección sigue pintando su título.
 */
export function EncabezadoSeccion({
  encabezado,
  titulo,
  descripcion,
  primaryColor,
}: {
  encabezado: Encabezado
  titulo?: string
  descripcion?: string
  primaryColor?: string
}) {
  const showTitle = encabezado.show_title !== false
  const showDesc = encabezado.show_description !== false
  const title = encabezado.title || titulo || ''
  const desc = encabezado.description || descripcion || ''
  const align = encabezado.align === 'right' ? 'text-right items-end' : encabezado.align === 'left' ? 'text-left items-start' : 'text-center items-center'
  const peso = CLASE_PESO[encabezado.title_weight || 'bold']
  const tam = CLASE_TAM_TITULO[encabezado.title_size || '2xl']
  const color = encabezado.title_color_2 && encabezado.title_color
    ? undefined
    : encabezado.title_color
  const degradado = encabezado.title_color && encabezado.title_color_2
    ? {
        backgroundImage: `linear-gradient(90deg, ${encabezado.title_color}, ${encabezado.title_color_2})`,
        WebkitBackgroundClip: 'text',
        color: 'transparent',
      } as CSSProperties
    : undefined
  const boton = encabezado.view_all && encabezado.view_all_url ? (
    <Link
      href={encabezado.view_all_url}
      className={
        encabezado.view_all_style === 'outline'
          ? 'inline-flex rounded-full border px-4 py-2 text-sm font-medium'
          : encabezado.view_all_style === 'ghost'
            ? 'inline-flex text-sm font-medium underline'
            : 'inline-flex rounded-full px-4 py-2 text-sm font-medium text-white'
      }
      style={encabezado.view_all_style === 'outline' || encabezado.view_all_style === 'ghost'
        ? { color: primaryColor, borderColor: primaryColor }
        : { backgroundColor: primaryColor }}
    >
      {encabezado.view_all_label || 'Ver todo'}
    </Link>
  ) : null

  const bloque = (
    <div className={`flex flex-col gap-2 ${align}`}>
      {encabezado.eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: primaryColor }}>{encabezado.eyebrow}</p>
      )}
      {showTitle && title && (
        <h2
          className={`${tam} ${peso} ${encabezado.title_uppercase ? 'uppercase' : ''} ${encabezado.title_line === 'below' ? 'border-b pb-2' : ''}`}
          style={{ color, borderColor: encabezado.line_color, ...(encabezado.title_font && encabezado.title_font !== 'site' ? { fontFamily: encabezado.title_font } : {}), ...degradado }}
        >
          {encabezado.title_line === 'sides' && <span className="mr-3 inline-block h-px w-8 align-middle" style={{ background: encabezado.line_color || primaryColor }} />}
          {title}
          {encabezado.title_line === 'sides' && <span className="ml-3 inline-block h-px w-8 align-middle" style={{ background: encabezado.line_color || primaryColor }} />}
        </h2>
      )}
      {showDesc && desc && (
        <p
          className={encabezado.description_size === 'lg' ? 'text-lg' : encabezado.description_size === 'sm' ? 'text-sm' : 'text-base'}
          style={{
            color: encabezado.description_color,
            maxWidth: encabezado.description_max ? `${encabezado.description_max}ch` : undefined,
          }}
        >
          {desc}
        </p>
      )}
    </div>
  )

  if (encabezado.layout === 'inline') {
    return (
      <div className={`mb-6 flex flex-wrap items-end justify-between gap-3 ${encabezado.align === 'center' ? '' : ''}`}>
        {bloque}
        {boton}
      </div>
    )
  }
  if (encabezado.layout === 'side') {
    return (
      <div className="mb-6">
        {bloque}
        {boton && <div className="mt-3">{boton}</div>}
      </div>
    )
  }
  return (
    <div className={`mb-6 flex flex-col gap-3 ${align}`}>
      {bloque}
      {boton}
    </div>
  )
}
