import type { CSSProperties, ReactNode } from 'react'
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
  controles,
}: {
  encabezado: Encabezado
  titulo?: string
  descripcion?: string
  primaryColor?: string
  /** Flechas del carrusel, a la derecha del enlace. */
  controles?: ReactNode
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
  const boton = encabezado.action && encabezado.action.position !== 'end'
    ? <AccionEncabezado accion={encabezado.action} primaryColor={primaryColor} />
    : null
  const medio = encabezado.media ? <Medio medio={encabezado.media} primaryColor={primaryColor} /> : null

  const bloque = (
    <div className={`flex flex-col gap-2 ${align}`}>
      {encabezado.eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: primaryColor }}>{encabezado.eyebrow}</p>
      )}
      {medio && encabezado.media?.place === 'above' ? medio : null}
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
          className={`${encabezado.description_size === 'lg' ? 'text-lg' : encabezado.description_size === 'sm' ? 'text-sm' : 'text-base'} ${CLASE_PESO[encabezado.description_weight || ''] || ''}`}
          style={{
            color: encabezado.description_color,
            maxWidth: encabezado.description_max ? `${encabezado.description_max}ch` : undefined,
            fontFamily: encabezado.description_font && encabezado.description_font !== 'site' ? encabezado.description_font : undefined,
          }}
        >
          {desc}
        </p>
      )}
    </div>
  )

  const conMedio = medio && encabezado.media?.place !== 'above'
    ? <div className="flex items-center gap-3">{medio}{bloque}</div>
    : bloque
  const filaAccion = (boton || controles)
    ? <div className="flex items-center gap-2">{boton}{controles}</div>
    : null
  if (encabezado.layout === 'inline' || encabezado.action?.position === 'inline') {
    return (
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        {conMedio}
        {filaAccion}
      </div>
    )
  }
  if (encabezado.layout === 'side') {
    return (
      <div className="mb-6">
        <div className="flex items-start justify-between gap-2">{conMedio}{controles}</div>
        {boton && <div className="mt-3">{boton}</div>}
      </div>
    )
  }
  return (
    <div className={`mb-6 flex flex-col gap-3 ${align}`}>
      <div className="flex w-full items-start justify-between gap-3">{conMedio}{controles}</div>
      {boton}
    </div>
  )
}

export function AccionEncabezado({ accion, primaryColor }: { accion: NonNullable<Encabezado['action']>; primaryColor?: string }) {
  const flecha = accion.icon || accion.kind === 'link' ? ' →' : ''
  if (accion.kind === 'link') {
    return (
      <Link href={accion.href} className={`inline-flex items-center text-sm font-medium ${accion.underline !== false ? 'hover:underline' : ''}`} style={{ color: accion.color || primaryColor }}>
        {accion.text}{flecha}
      </Link>
    )
  }
  const forma = accion.shape === 'square' ? 'rounded-none' : accion.shape === 'rounded' ? 'rounded-md' : 'rounded-full'
  const contorno = accion.style === 'outline'
  const ghost = accion.style === 'ghost'
  return (
    <Link
      href={accion.href}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium ${forma} ${contorno ? 'border' : ''} ${ghost ? 'underline-offset-4 hover:underline' : ''}`}
      style={contorno || ghost
        ? { color: accion.color || primaryColor, borderColor: accion.color || primaryColor }
        : { backgroundColor: accion.color || primaryColor, color: accion.textColor || '#fff' }}
    >
      {accion.text}{accion.icon ? flecha : ''}
    </Link>
  )
}

function Medio({ medio, primaryColor }: { medio: NonNullable<Encabezado['media']>; primaryColor?: string }) {
  const tam = medio.size ?? 40
  const radio = medio.shape === 'circle' ? '999px' : medio.shape === 'square' ? '0' : '10px'
  if (medio.kind === 'image' && medio.src) {
    return <img src={medio.src} alt="" style={{ width: tam, height: tam, borderRadius: radio, objectFit: 'cover' }} />
  }
  return (
    <span className="inline-flex items-center justify-center text-lg" style={{ width: tam, height: tam, borderRadius: radio, background: primaryColor, color: '#fff' }} aria-hidden>
      {medio.icon?.slice(0, 2)}
    </span>
  )
}
