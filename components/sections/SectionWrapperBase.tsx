import type { Json } from '@/types/database'
import { buildSectionStyle } from '@/lib/sectionStyle'
import { heroSolapa, margenExplicito, offsetPrimeraPx, paddingExplicito, pxEnRango } from '@/lib/website/espacioHeader'
import { presentacionSeccion } from '@/lib/website/v2/estiloSeccionPublico'
import { urlGoogleFonts } from '@/lib/website/v2/temaPublico'
import { EntradaSeccion } from './EntradaSeccion'
import { EncabezadoSeccion } from './EncabezadoSeccion'
import { AccionEncabezado } from './EncabezadoSeccion'
import { CarruselShell, HuecoFlechas } from './ListRenderer'
import { combinarEncabezado, estilosFondo, leerFondo, listaDelInspector, type EncabezadoSeccion as DatosEncabezado } from '@/lib/website/cascaronSeccion'

interface SectionSettings {
  bg_color?: string | null
  text_color?: string | null
  padding?: 'small' | 'medium' | 'large' | 'none'
  max_width?: string
  [key: string]: Json | undefined
}

export interface SectionWrapperProps {
  settings: SectionSettings
  content?: Record<string, any>
  primaryColor?: string
  sectionType?: string
  /** Variante de la sección (la Carta QR ajusta márgenes por variante). */
  sectionVariant?: string
  sectionId?: string
  /** `tema.seccion` del sitio. Ausente = no se hereda nada. */
  estiloGlobal?: unknown
  /** Primera sección visible de la página. Sin padding ni margen propios, queda pegada al header. */
  isFirst?: boolean
  /** Ajustes del sitio (`header_transparent_over_hero`, `first_section_offset_px`). */
  ajustesSitio?: Record<string, unknown> | null
  children: React.ReactNode
}

// Anchos máximos por container_width del contrato de estilo
const CONTAINER_MAX: Record<string, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1400px]',
  full: 'max-w-none',
}

const PADDING_Y_MAP: Record<string, string> = {
  none: '',
  xs: 'py-2',
  sm: 'py-4 md:py-6',
  md: 'py-8 md:py-12',
  lg: 'py-12 md:py-16',
  xl: 'py-16 md:py-24',
}

const PADDING_X_MAP: Record<string, string> = {
  none: 'px-0',
  sm: 'px-2 md:px-4',
  md: 'px-4 md:px-6 lg:px-8',
  lg: 'px-6 md:px-10 lg:px-16',
  xl: 'px-8 md:px-16 lg:px-24',
}

/**
 * Clase de un mapa de espaciado. `none` vale '' (sin relleno), y '' es falsy: con
 * `map[k] || fallback` el «Ninguno» del editor caía al relleno por defecto (lg).
 * Solo se usa el fallback cuando la clave no existe en el mapa.
 */
export function claseDe(map: Record<string, string>, clave: string, fallback: string): string {
  return Object.prototype.hasOwnProperty.call(map, clave) ? map[clave] : fallback
}

const MARGIN_MAP: Record<string, string> = {
  none: '',
  xs: '2',
  sm: '4',
  md: '8',
  lg: '12',
  xl: '16',
}

/**
 * Carta QR en la mesa: sus secciones son barras y pantallas de la mesa, no bloques de contenido;
 * sin márgenes propios salvo que el editor los fije. La portada «mesa» va a sangre como en la
 * lámina 01. Las demás secciones, con los valores de siempre.
 */
const SIN_RELLENO_POR_DEFECTO: ReadonlySet<string> = new Set([
  'table_service', 'table_order', 'table_bill', 'visit_feedback', 'restaurant_hero:mesa',
])

export function SectionWrapperBase({ settings, content: contentGuardado, primaryColor, sectionType, sectionVariant, sectionId, estiloGlobal, isFirst = false, ajustesSitio, children }: SectionWrapperProps) {
  // Estilo por sección y visibilidad por dispositivo del editor (lib/website/v2/estiloSeccionPublico).
  // Sin estilo guardado devuelve el mismo `content` y ningún atributo: la sección sale igual que antes.
  const presentacion = presentacionSeccion(settings as Record<string, unknown>, contentGuardado)
  if (presentacion.oculta) return null
  const content = presentacion.contenido as Record<string, any>
  const sinRelleno = SIN_RELLENO_POR_DEFECTO.has(sectionType ?? '') || SIN_RELLENO_POR_DEFECTO.has(`${sectionType}:${sectionVariant}`)
  // La carta «qr» empieza pegada a la barra de la mesa.
  const cartaQr = sectionType === 'menu_full' && sectionVariant === 'qr'
  const ptExplicito = paddingExplicito(content?.padding_top)
  const mtExplicito = margenExplicito(content?.margin_top)
  const ptPx = pxEnRango(content?.padding_top_px, 0, 480)
  const pbPx = pxEnRango(content?.padding_bottom_px, 0, 480)
  const paddingTop = ptExplicito ? String(content.padding_top) : (sinRelleno || cartaQr ? 'none' : 'lg')
  const paddingBottom = content?.padding_bottom || (sinRelleno ? 'none' : 'lg')
  const paddingX = content?.padding_x || (sinRelleno ? 'none' : 'md')
  const marginTop = content?.margin_top || 'none'
  const marginBottom = content?.margin_bottom || 'none'

  // full_bleed: default true solo para hero, false para el resto
  const isHero = sectionType === 'hero'
  const isFullBleed = content?.full_bleed === true
    || (content?.full_bleed === undefined && content?.container_width === undefined && isHero)
    || content?.container_width === 'full'

  // Solape solo si el sitio o el alias `overlap_header` lo piden. El default es no.
  const solapa = isHero && heroSolapa(ajustesSitio, content?.overlap_header)
  const offset = isFirst ? offsetPrimeraPx(ajustesSitio) : 0

  // Construir clases de padding vertical individuales
  const ptMap: Record<string, string> = {
    none: '', xs: 'pt-2', sm: 'pt-4 md:pt-6', md: 'pt-8 md:pt-12', lg: 'pt-12 md:pt-16', xl: 'pt-16 md:pt-24',
  }
  const pbMap: Record<string, string> = {
    none: '', xs: 'pb-2', sm: 'pb-4 md:pb-6', md: 'pb-8 md:pb-12', lg: 'pb-12 md:pb-16', xl: 'pb-16 md:pb-24',
  }
  const mtMap: Record<string, string> = {
    none: '', xs: 'mt-2', sm: 'mt-4', md: 'mt-8', lg: 'mt-12', xl: 'mt-16',
  }
  const mbMap: Record<string, string> = {
    none: '', xs: 'mb-2', sm: 'mb-4', md: 'mb-8', lg: 'mb-12', xl: 'mb-16',
  }

  // Con solape, el alto del header lo reserva el hero (`padding-top: var(--header-h)`),
  // sin margen negativo. La primera sección, sin padding ni margen propios, queda en 0.
  // `padding_*_px` gana al tamaño fijo. Un valor explícito se respeta.
  let pt = solapa
    ? (ptExplicito && content?.padding_top !== 'lg' ? claseDe(ptMap, paddingTop, '') : '')
    : claseDe(ptMap, paddingTop, ptMap.lg)
  let pb = claseDe(pbMap, paddingBottom, pbMap.lg)
  const px = claseDe(PADDING_X_MAP, paddingX, PADDING_X_MAP.md)
  let mt = solapa
    ? (mtExplicito ? (mtMap[marginTop] || '') : '')
    : (mtMap[marginTop] || '')
  const mb = mbMap[marginBottom] || ''
  if (ptPx != null) pt = ''
  if (pbPx != null) pb = ''
  if (isFirst && !ptExplicito && ptPx == null && !solapa) pt = ''
  if (isFirst && !mtExplicito) mt = ''

  // ---- Contrato de estilo (F2.1) ----
  // buildSectionStyle traduce content + settings a clases estáticas + CSS vars.
  // Devuelve clases de fondo/texto/radio/sombra/borde + layout (w-full, mx-auto, max-w-*).
  // El layout se descarta aquí porque el <div> interno ya lo maneja (con px).
  const { className: contractClassName, style: contractStyle } = buildSectionStyle(
    content,
    settings,
    sectionType,
  )

  // Filtrar clases de layout que maneja el div interno (w-full, mx-auto, max-w-*)
  const visualClasses = contractClassName
    .split(' ')
    .filter((cls) => cls && !['w-full', 'mx-auto'].includes(cls) && !cls.startsWith('max-w-'))
    .join(' ')

  // Merge: el estilo del contrato (bg image, gradient, border, CSS vars) + fallback viejo
  const style: React.CSSProperties = { ...contractStyle, ...(presentacion.variables as React.CSSProperties) }
  const hasContractBg = '--sec-bg' in (contractStyle as any)
  const hasContractText = '--sec-text' in (contractStyle as any)

  // Fallback: si el contrato no aplicó bg/text (bg_type ausente), usar formato viejo de settings
  if (!hasContractBg && settings.bg_color) (style as any)['--section-bg'] = settings.bg_color
  if (!hasContractText && settings.text_color) (style as any)['--section-text'] = settings.text_color
  // ESTILO-07: el borde de la sección sin color propio toma «Color del borde» de Estilo (una sola opción).
  if (typeof content?.border_width === 'number' && content.border_width > 0 && !content?.border_color && presentacion.variables['--seccion-color-borde']) {
    style.borderColor = 'var(--seccion-color-borde)'
  }
  if (ptPx != null) style.paddingTop = ptPx
  else if (isFirst && !ptExplicito && !solapa && offset > 0) style.paddingTop = offset
  if (pbPx != null) style.paddingBottom = pbPx
  if (isFirst && !mtExplicito && offset > 0 && (ptExplicito || ptPx != null || solapa)) style.marginTop = offset

  const encabezado = combinarEncabezado(content, estiloGlobal)
  // ENCABE-93/97: la fuente elegida para el título o la descripción del encabezado también se carga.
  const fuentesEncabezado = [encabezado?.title_font, encabezado?.description_font].filter((f) => f && f !== 'site')
  const hojaFuentes = urlGoogleFonts([...presentacion.fuentes, ...fuentesEncabezado])
  const flechasArriba = listaDelInspector(content)?.arrows === 'top'
  const fondoNuevo = leerFondo(content)
  if (fondoNuevo) Object.assign(style, estilosFondo(fondoNuevo))
  // Margen superior propio en la primera sección: se suma al alto del header (si no, 0 la tapaba).
  if (fondoNuevo?.padding_top != null && isFirst && !solapa && offset > 0) {
    style.paddingTop = offset + fondoNuevo.padding_top
    // El alto del header ya va en el padding: no repetirlo como margen (espacio viejo + nuevo).
    if (!mtExplicito) style.marginTop = undefined
  }
  const ptCaja = fondoNuevo?.padding_top != null ? '' : pt
  const pbCaja = fondoNuevo?.padding_bottom != null ? '' : pb
  const anchoForzado = fondoNuevo?.width === 'full' ? true : fondoNuevo?.width === 'content' ? false : null

  const bgClass = !hasContractBg && settings.bg_color && !fondoNuevo?.color && !fondoNuevo?.gradient_1 && !fondoNuevo?.image_url
    ? 'bg-[var(--section-bg)] dark:bg-gray-900/40'
    : ''
  const textClass = !hasContractText && settings.text_color
    ? 'text-[var(--section-text)] dark:text-gray-100'
    : ''

  // Contenedor interno: full-bleed (w-full) o ancho explícito con max-w + mx-auto
  // Para hero full-bleed NO añadimos padding (el hero gestiona su propio padding interno).
  // Para secciones no-hero full-bleed sí añadimos padding horizontal para que el contenido
  // no quede pegado a los bordes.
  const containerWidth = content?.container_width || 'lg'
  const sangria = anchoForzado == null ? isFullBleed : anchoForzado
  const innerClass = sangria
    ? (isHero ? 'w-full' : `w-full ${px}`)
    : `w-full mx-auto ${CONTAINER_MAX[containerWidth] || CONTAINER_MAX.lg} ${px}`
  const encabezadoNodo = encabezado ? (
    <EncabezadoSeccion
      encabezado={encabezado}
      // La portada pinta su propio título y subtítulo: el encabezado no los repite (HERO-01/02).
      titulo={!isHero && typeof content?.title === 'string' ? content.title : undefined}
      descripcion={!isHero && typeof content?.subtitle === 'string' ? content.subtitle : undefined}
      primaryColor={primaryColor}
      controles={flechasArriba ? <HuecoFlechas /> : undefined}
    />
  ) : null

  return (
    <section
      className={fondoNuevo?.overlay_opacity
        ? `w-full relative ${ptCaja} ${pbCaja} ${mt} ${mb} ${bgClass} ${textClass} ${visualClasses}`
        : `w-full ${ptCaja} ${pbCaja} ${mt} ${mb} ${bgClass} ${textClass} ${visualClasses}`}
      style={style}
      data-section-id={sectionId}
      data-encabezado-shell={encabezado ? '' : undefined}
      data-fondo-movil={fondoNuevo?.image_url_mobile ? '' : undefined}
      data-primera-hero={isFirst && solapa ? '' : undefined}
      {...presentacion.datos}
    >
      {hojaFuentes && <link rel="stylesheet" href={hojaFuentes} />}
      {'data-seccion-entrada' in presentacion.datos && <EntradaSeccion />}
      {fondoNuevo?.overlay_opacity ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${fondoNuevo.overlay_opacity / 100})` }} />
      ) : null}
      {fondoNuevo?.separator === 'wave' && <Separador forma="wave" color={fondoNuevo.separator_color} />}
      {fondoNuevo?.separator === 'diagonal' && <Separador forma="diagonal" color={fondoNuevo.separator_color} />}
      {fondoNuevo?.separator === 'line' && <hr className="relative z-10 mx-auto mb-2 w-full max-w-7xl border-t" style={{ borderColor: fondoNuevo.separator_color }} />}
      {flechasArriba ? (
        <CarruselShell>
          <CuerpoSeccion
            innerClass={innerClass}
            overlay={Boolean(fondoNuevo?.overlay_opacity)}
            encabezado={encabezado}
            encabezadoNodo={encabezadoNodo}
            primaryColor={primaryColor}
          >
            {children}
          </CuerpoSeccion>
        </CarruselShell>
      ) : (
        <CuerpoSeccion
          innerClass={innerClass}
          overlay={Boolean(fondoNuevo?.overlay_opacity)}
          encabezado={encabezado}
          encabezadoNodo={encabezadoNodo}
          primaryColor={primaryColor}
        >
          {children}
        </CuerpoSeccion>
      )}
    </section>
  )
}

function CuerpoSeccion({
  innerClass,
  overlay,
  encabezado,
  encabezadoNodo,
  primaryColor,
  children,
}: {
  innerClass: string
  overlay: boolean
  encabezado: DatosEncabezado | null
  encabezadoNodo: React.ReactNode
  primaryColor?: string
  children: React.ReactNode
}) {
  return (
    <div className={`${innerClass}${overlay ? ' relative z-10' : ''}`}>
      {encabezado?.layout === 'side' ? (
        <div className="grid items-start gap-6 md:grid-cols-[minmax(12rem,22rem)_1fr]">
          {encabezadoNodo}
          <div>{children}</div>
        </div>
      ) : (
        <>
          {encabezadoNodo}
          {children}
        </>
      )}
      {encabezado?.action?.position === 'end' && (
        <div className="mt-8 flex justify-center">
          <AccionEncabezado accion={encabezado.action} primaryColor={primaryColor} />
        </div>
      )}
    </div>
  )
}

function Separador({ forma, color }: { forma: 'wave' | 'diagonal'; color?: string }) {
  const fill = color || 'currentColor'
  if (forma === 'diagonal') {
    return <div className="h-8 w-full" style={{ background: `linear-gradient(to bottom right, transparent 49%, ${fill} 50%, transparent 51%)` }} />
  }
  return (
    <svg viewBox="0 0 1440 48" className="block h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 24c120 24 240 24 360 0s240-24 360 0 240 24 360 0 240-24 360 0v24H0z" fill={fill} />
    </svg>
  )
}
