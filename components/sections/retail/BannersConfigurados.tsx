'use client'

/**
 * Banners con `banner_layout` / `banner_style`. Solo se monta cuando esas claves
 * existen: si no, PromoBannersGrid sigue con el render de hoy.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { claseAspectoBanner, claseImagenBanner, clasesColumnasBanner } from '@/lib/website/presentacionTienda'
import {
  bloquesDistribucion,
  posicionFocal,
  radioBotonBanner,
  type BloqueBanner,
  type ConfigBanners,
  type EstiloBanners,
} from '@/lib/website/distribucionBanner'
import { resolveBannerHref, type BannerItem } from '@/lib/website/enlaceBanner'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

const POS_BOTON: Record<string, string> = {
  tl: 'top-3 left-3',
  tc: 'top-3 left-1/2 -translate-x-1/2',
  tr: 'top-3 right-3',
  ml: 'top-1/2 left-3 -translate-y-1/2',
  mc: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  mr: 'top-1/2 right-3 -translate-y-1/2',
  bl: 'bottom-3 left-3',
  bc: 'bottom-3 left-1/2 -translate-x-1/2',
  br: 'bottom-3 right-3',
}

const SOMBRA: Record<string, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
}

const PESO: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

const TAM_TITULO: Record<string, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl md:text-4xl',
}

function fotoProducto(product: any): string | null {
  if (!product?.product_images?.length) return null
  const primary = product.product_images.find((img: any) => img.is_primary) || product.product_images[0]
  const path = primary?.storage_path || primary?.shared_images?.storage_path
  return path ? `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}` : null
}

function radioForma(estilo: EstiloBanners): string {
  if (estilo.banner_radius != null) return ''
  if (estilo.banner_shape === 'rect') return 'rounded-none'
  if (estilo.banner_shape === 'semi') return 'rounded-[14px]'
  if (estilo.banner_shape === 'circle') return 'rounded-full'
  if (estilo.banner_shape === 'arch') return 'rounded-t-[999px] rounded-b-2xl'
  return 'rounded-2xl'
}

function degradado(estilo: EstiloBanners): string | undefined {
  if (estilo.overlay === 'none' || !estilo.overlay) return undefined
  const op = (estilo.overlay_opacity ?? 55) / 100
  const c1 = estilo.overlay_color || `rgb(0 0 0 / ${op})`
  const c2 = estilo.overlay_color_2 || 'transparent'
  const ang = estilo.overlay_angle ?? (estilo.overlay_position === 'left' ? 90 : 180)
  if (estilo.overlay === 'solid') return `linear-gradient(${ang}deg, ${c1}, ${c1})`
  if (estilo.overlay_position === 'full') return `linear-gradient(${ang}deg, ${c1}, ${c2})`
  if (estilo.overlay_position === 'left') return `linear-gradient(90deg, ${c1}, transparent)`
  return `linear-gradient(to top, ${c1}, transparent)`
}

interface Props {
  content: {
    title?: string
    subtitle?: string
    columns?: unknown
    columns_mobile?: unknown
    aspect_ratio?: unknown
    aspect_ratio_mobile?: unknown
    image_fit?: unknown
    image_position?: unknown
    banners?: BannerItem[]
  }
  config: ConfigBanners
  primaryColor: string
  data?: Parameters<typeof resolveBannerHref>[1] & {
    bannerCategoryProducts?: Record<string, any[]>
  }
}

export function BannersConfigurados({ content, config, primaryColor, data }: Props) {
  const banners = content.banners || []
  const estilo = config.estilo
  const layout = config.layout
  const gap = estilo.gap
  const movil = estilo.mobile_layout
  const bloques = bloquesDistribucion(layout, banners.length, config.ultimoAncho)
  const indices = new Set(bloques.flatMap((b) => b.celdas.map((c) => c.index)))
  const visibles = layout === 'grid' || layout === 'masonry' || layout === 'carousel' || layout === 'circles' || layout === 'full_stack' || layout === 'side_text'
    ? banners.map((_, i) => i)
    : [...indices]

  const fondoSeccion: CSSProperties = {}
  if (estilo.section_bg && estilo.section_bg_2) {
    fondoSeccion.backgroundImage = `linear-gradient(${estilo.section_bg_angle ?? 180}deg, ${estilo.section_bg}, ${estilo.section_bg_2})`
  } else if (estilo.section_bg) {
    fondoSeccion.backgroundColor = estilo.section_bg
  }
  if (estilo.section_margin != null) fondoSeccion.padding = estilo.section_margin

  const aspecto = claseAspectoBanner(content.aspect_ratio, content.aspect_ratio_mobile)
  const columnas = layout === 'grid'
    ? clasesColumnasBanner(
      estilo.columns_desktop != null
        ? { desktop: estilo.columns_desktop, tablet: estilo.columns_tablet, mobile: estilo.columns_mobile }
        : content.columns,
      'grid',
      estilo.columns_mobile ?? content.columns_mobile,
    )
    : ''

  return (
    <div style={fondoSeccion}>
      {movil === 'stack' && (
        <style>{`@media (max-width:767px){[data-banners-movil="stack"]{display:flex !important;flex-direction:column !important}[data-banners-movil="stack"]>*{width:100% !important}}`}</style>
      )}
      {content.title && (
        <h2 className="titulo-legado text-2xl md:text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>}
      {banners.length === 0 ? (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">🏷️</p>
          <p>No hay promociones activas</p>
        </div>
      ) : layout === 'carousel' || movil === 'carousel' ? (
        <Carrusel
          banners={banners}
          estilo={estilo}
          primaryColor={primaryColor}
          data={data}
          content={content}
          aspecto={aspecto}
          soloMovil={layout !== 'carousel' && movil === 'carousel'}
          respaldo={layout !== 'carousel' ? (
            <Rejilla
              banners={banners}
              visibles={visibles}
              bloques={bloques}
              layout={layout}
              estilo={estilo}
              gap={gap}
              columnas={columnas}
              aspecto={aspecto}
              primaryColor={primaryColor}
              data={data}
              content={content}
              movil={movil}
              className="max-md:hidden"
            />
          ) : null}
        />
      ) : (
        <Rejilla
          banners={banners}
          visibles={visibles}
          bloques={bloques}
          layout={layout}
          estilo={estilo}
          gap={gap}
          columnas={columnas}
          aspecto={aspecto}
          primaryColor={primaryColor}
          data={data}
          content={content}
          movil={movil}
        />
      )}
    </div>
  )
}

function Rejilla(props: {
  banners: BannerItem[]
  visibles: number[]
  bloques: BloqueBanner[]
  layout: ConfigBanners['layout']
  estilo: EstiloBanners
  gap: number | undefined
  columnas: string
  aspecto: string
  primaryColor: string
  data: Props['data']
  content: Props['content']
  movil: EstiloBanners['mobile_layout']
  className?: string
}) {
  const { banners, layout, estilo, gap, primaryColor, data, content, movil } = props
  const separacion = gap == null ? undefined : { gap }
  const tarjeta = (i: number, extra?: CSSProperties, destacada?: boolean, indice?: number) => (
    <Tarjeta
      key={i}
      banner={banners[i]}
      estilo={estilo}
      primaryColor={primaryColor}
      data={data}
      content={content}
      aspecto={props.aspecto}
      layout={layout}
      destacada={destacada}
      extra={extra}
      indice={indice ?? i}
    />
  )

  if (layout === 'masonry') {
    return (
      <div className={`columns-1 sm:columns-2 lg:columns-3 ${props.className ?? ''}`} style={{ columnGap: gap ?? 24 }}>
        {banners.map((_, i) => (
          <div key={i} className="mb-6 break-inside-avoid">{tarjeta(i)}</div>
        ))}
      </div>
    )
  }
  if (layout === 'circles') {
    return (
      <div className={`flex gap-4 overflow-x-auto pb-2 ${props.className ?? ''}`} style={separacion}>
        {banners.map((_, i) => tarjeta(i))}
      </div>
    )
  }
  if (layout === 'side_text') {
    return (
      <div className={`flex flex-col gap-6 ${props.className ?? ''}`} style={separacion}>
        {banners.map((_, i) => tarjeta(i, undefined, undefined, i))}
      </div>
    )
  }
  if (layout === 'full_stack') {
    return (
      <div className={`grid grid-cols-1 gap-6 ${props.className ?? ''}`} style={separacion}>
        {banners.map((_, i) => tarjeta(i))}
      </div>
    )
  }
  if (layout === 'grid' || props.bloques.length === 0) {
    return (
      <div
        className={`${props.columnas || 'grid grid-cols-1 md:grid-cols-2 gap-6'}${gap == null ? '' : ''} ${props.className ?? ''}`}
        style={separacion}
        data-banners-movil={movil === 'stack' ? 'stack' : undefined}
      >
        {(layout === 'grid' ? banners.map((_, i) => i) : props.visibles).map((i) => tarjeta(i))}
      </div>
    )
  }
  return (
    <div className={`flex flex-col ${props.className ?? ''}`} style={separacion ?? { gap: 24 }} data-banners-movil={movil === 'stack' ? 'stack' : undefined}>
      {props.bloques.map((bloque, bi) => (
        <div
          key={bi}
          className="grid"
          style={{
            gridTemplateColumns: bloque.plantilla,
            gridTemplateRows: `repeat(${bloque.filas}, minmax(160px, 1fr))`,
            gap: gap ?? 24,
            minHeight: bloque.filas > 1 ? bloque.filas * 180 : undefined,
          }}
        >
          {bloque.celdas.map((c) => tarjeta(c.index, {
            gridColumn: `${c.col} / span ${c.colSpan}`,
            gridRow: `${c.row} / span ${c.rowSpan}`,
          }, c.destacada))}
        </div>
      ))}
    </div>
  )
}

function Carrusel(props: {
  banners: BannerItem[]
  estilo: EstiloBanners
  primaryColor: string
  data: Props['data']
  content: Props['content']
  aspecto: string
  soloMovil: boolean
  respaldo: ReactNode
}) {
  const visibles = props.estilo.slides ?? 1
  const paginas = Math.max(1, props.banners.length - visibles + 1)
  const [pagina, setPagina] = useState(0)
  useEffect(() => {
    if (props.estilo.autoplay === false) return
    if (!props.estilo.autoplay && props.estilo.interval_ms == null) return
    const id = setInterval(() => setPagina((p) => (p + 1) % paginas), props.estilo.interval_ms ?? 5000)
    return () => clearInterval(id)
  }, [props.estilo.autoplay, props.estilo.interval_ms, paginas])
  const flechas = props.estilo.show_arrows !== false
  const puntos = props.estilo.show_dots !== false
  const riel = (
    <div className="relative">
      {flechas && (
        <button type="button" aria-label="Anterior" onClick={() => setPagina((p) => (p - 1 + paginas) % paginas)} className="absolute left-0 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow">
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="overflow-hidden">
        <div className="flex transition-transform duration-300" style={{ transform: `translateX(-${pagina * (100 / visibles)}%)` }}>
          {props.banners.map((banner, i) => (
            <div key={i} className="px-2" style={{ flex: `0 0 ${100 / visibles}%` }}>
              <Tarjeta banner={banner} estilo={props.estilo} primaryColor={props.primaryColor} data={props.data} content={props.content} aspecto={props.aspecto} layout="carousel" />
            </div>
          ))}
        </div>
      </div>
      {flechas && (
        <button type="button" aria-label="Siguiente" onClick={() => setPagina((p) => (p + 1) % paginas)} className="absolute right-0 top-1/2 z-20 flex h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow">
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
      {puntos && paginas > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: paginas }).map((_, i) => (
            <button key={i} type="button" aria-label={`Página ${i + 1}`} onClick={() => setPagina(i)} className={`h-2 rounded-full ${i === pagina ? 'w-6' : 'w-2 bg-gray-300'}`} style={i === pagina ? { backgroundColor: props.primaryColor } : undefined} />
          ))}
        </div>
      )}
    </div>
  )
  if (!props.soloMovil) return riel
  return (
    <>
      <div className="max-md:hidden">{props.respaldo}</div>
      <div className="md:hidden">{riel}</div>
    </>
  )
}

function Tarjeta(props: {
  banner: BannerItem
  estilo: EstiloBanners
  primaryColor: string
  data: Props['data']
  content: Props['content']
  aspecto: string
  layout: ConfigBanners['layout']
  destacada?: boolean
  extra?: CSSProperties
  indice?: number
}) {
  const { banner, estilo, primaryColor, data, content, layout } = props
  const href = resolveBannerHref(banner, data)
  const escritorio = banner.image_url
  const movil = banner.image_url_mobile
  const hoverImg = banner.image_url_hover
  const fit = banner.image_fit === 'contain' || banner.image_fit === 'cover' ? banner.image_fit : content.image_fit
  const focal = posicionFocal(banner.focal_point) || undefined
  const mostrarTexto = banner.show_overlay_text ?? estilo.show_overlay_text
  const textoVisible = mostrarTexto !== false && layout !== 'circles' && layout !== 'side_text'
  const textoCirculo = layout === 'circles' || layout === 'side_text'
  const alinear = estilo.text_align === 'center' ? 'items-center text-center' : estilo.text_align === 'right' ? 'items-end text-right' : 'items-start text-left'
  const vertical = estilo.text_valign === 'top' ? 'justify-start' : estilo.text_valign === 'bottom' ? 'justify-end' : 'justify-center'
  const revelar = estilo.hover === 'reveal'
  const claseRevelar = revelar ? 'opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100' : ''
  const zoom = estilo.hover === 'zoom' ? ' transition-transform duration-300 group-hover:scale-105' : ''
  const oscuro = estilo.hover === 'darken' ? ' transition duration-300 group-hover:brightness-75' : ''
  const elevar = estilo.hover === 'lift' ? ' transition-transform duration-300 group-hover:-translate-y-1' : ''
  const forma = radioForma(estilo)
  const radio = estilo.banner_radius != null ? { borderRadius: layout === 'circles' ? 9999 : estilo.banner_radius } : undefined
  const borde = estilo.border_width
    ? { borderWidth: estilo.border_width, borderStyle: 'solid' as const, borderColor: estilo.border_color || '#E5E7EB' }
    : undefined
  const sombra = estilo.shadow ? SOMBRA[estilo.shadow] : ''
  const altoNatural = (props.aspecto === 'h-auto' && layout === 'grid' && !movil) || layout === 'masonry'
  const claseFoto = layout === 'circles'
    ? `h-full w-full object-cover${zoom}${oscuro}`
    : altoNatural
      ? `block w-full h-auto${zoom}${oscuro}`
      : `${claseImagenBanner(fit, content.image_position)}${zoom}${oscuro}`
  const estiloFoto: CSSProperties = focal ? { objectPosition: focal } : {}
  const scrim = degradado(estilo)
  const boton = botonDe(banner, estilo, primaryColor)

  const media = (
    <>
      {escritorio && (
        <img src={escritorio} alt={banner.alt || banner.title || ''} className={`${claseFoto}${movil ? ' hidden md:block' : ''}`} style={estiloFoto} />
      )}
      {movil && (
        <img src={movil} alt={banner.alt || banner.title || ''} className={`${claseFoto} md:hidden`} style={estiloFoto} />
      )}
      {estilo.hover === 'second' && hoverImg && (
        <img src={hoverImg} alt="" className={`${claseFoto} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} style={estiloFoto} />
      )}
    </>
  )

  const textos = (banner.kicker || banner.title || banner.subtitle) && (
    <div className={claseRevelar} style={{ color: banner.text_color || estilo.text_color || (layout === 'side_text' ? '#111827' : '#ffffff') }}>
      {banner.kicker && <p className="mb-1 text-xs font-semibold uppercase tracking-wide">{banner.kicker}</p>}
      {banner.title && (
        <h3 className={`mb-2 ${PESO[estilo.title_weight || 'bold']} ${TAM_TITULO[estilo.title_size || 'md']}`}>{banner.title}</h3>
      )}
      {banner.subtitle && <p className="mb-4 opacity-90">{banner.subtitle}</p>}
    </div>
  )

  const preview = previewProductos(banner, data)
  const cuerpo = (
    <div
      className={layout === 'circles'
        ? 'w-28 shrink-0 text-center'
        : layout === 'side_text'
          ? ''
          : `relative overflow-hidden ${forma} ${sombra} ${altoNatural ? 'w-full' : `${props.aspecto} flex flex-col ${vertical} p-8 w-full`} ${props.destacada ? 'min-h-[240px] md:min-h-[320px]' : ''}`}
      style={{
        backgroundColor: banner.bg_color || (escritorio ? undefined : primaryColor),
        ...radio,
        ...borde,
        ...(layout !== 'circles' && layout !== 'side_text' && !altoNatural ? {} : {}),
      }}
    >
      {layout === 'circles' ? (
        <>
          <div className={`relative aspect-square overflow-hidden ${estilo.banner_shape === 'rounded' ? 'rounded-2xl' : 'rounded-full'} ${sombra}`} style={radio}>
            {media}
          </div>
          {banner.title && <p className="mt-2 text-xs font-medium text-gray-900 dark:text-white">{banner.title}</p>}
        </>
      ) : (
        <>
          {media}
          {scrim && textoVisible && <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: scrim }} />}
          {textoVisible && (
            <div className={`${altoNatural ? 'absolute inset-0 z-10 flex flex-col p-8' : 'relative z-10'} ${vertical} ${alinear} ${claseRevelar ? '' : ''}`}>
              {textos}
              {preview}
              {boton && !estilo.button_position && <div className={claseRevelar}>{boton}</div>}
            </div>
          )}
          {boton && estilo.button_position && (
            <div className={`absolute z-20 ${POS_BOTON[estilo.button_position] || POS_BOTON.bl} ${claseRevelar}`}>{boton}</div>
          )}
          {!textoVisible && boton && !estilo.button_position && layout !== 'side_text' && (
            <div className={`absolute bottom-3 left-3 z-20 ${claseRevelar}`}>{boton}</div>
          )}
        </>
      )}
    </div>
  )

  const pieza = layout === 'side_text' ? (
    <div className="grid items-center gap-6 md:grid-cols-2">
      <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl ${sombra} ${forma} ${(props.indice ?? 0) % 2 === 1 ? 'md:order-2' : ''}`} style={{ ...radio, ...borde }}>{media}</div>
      <div className={alinear}>
        {textos && <div style={{ color: banner.text_color || estilo.text_color || '#111827' }}>{textos}</div>}
        {boton}
      </div>
    </div>
  ) : cuerpo

  const marcado = (
    <div className={`group ${elevar}`} style={props.extra}>
      {pieza}
    </div>
  )
  return href ? <Link href={href} className="block">{marcado}</Link> : marcado
}

function botonDe(banner: BannerItem, estilo: EstiloBanners, primaryColor: string) {
  const texto = banner.button_text || banner.cta_text
  if (estilo.button_on === false) return null
  if (!texto && estilo.button_on !== true) return null
  const etiqueta = texto || 'Ver más'
  const variante = estilo.button_style || banner.button_style || 'solid'
  const clasico = !estilo.button_style && !estilo.button_bg && !estilo.button_shape && !estilo.button_position
  if (clasico) {
    const clases = {
      solid: 'bg-white text-gray-900 hover:bg-gray-100',
      outline: 'border border-white text-white hover:bg-white hover:text-gray-900',
      ghost: 'text-white hover:underline',
    }[variante as 'solid' | 'outline' | 'ghost'] || 'bg-white text-gray-900'
    return <span className={`inline-block px-5 py-2 rounded-lg font-medium transition-colors ${clases}`}>{etiqueta}</span>
  }
  const soloIcono = variante === 'icon_only'
  const radio = radioBotonBanner(estilo.button_shape, soloIcono)
  const style: CSSProperties = { borderRadius: radio }
  const bg = estilo.button_bg || primaryColor
  const colorTexto = estilo.button_color || (variante === 'outline' || variante === 'ghost' ? bg : '#ffffff')
  if (variante === 'gradient' && estilo.button_gradient_1 && estilo.button_gradient_2) {
    style.backgroundImage = `linear-gradient(${estilo.button_gradient_angle ?? 135}deg, ${estilo.button_gradient_1}, ${estilo.button_gradient_2})`
    style.color = colorTexto
  } else if (variante === 'outline') {
    style.background = 'transparent'
    style.color = colorTexto
    style.border = `1px solid ${estilo.button_border || bg}`
  } else if (variante === 'ghost') {
    style.background = 'transparent'
    style.color = colorTexto
  } else {
    style.background = bg
    style.color = colorTexto
  }
  const tam = estilo.button_size === 'lg' ? 'px-6 py-3 text-base' : estilo.button_size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2 text-sm'
  return (
    <span className={`inline-flex items-center justify-center font-medium ${tam}`} style={style}>
      {soloIcono ? <ArrowRight className="h-4 w-4" /> : etiqueta}
    </span>
  )
}

function previewProductos(banner: BannerItem, data: Props['data']) {
  if (banner.link_type !== 'category' || banner.show_category_products !== true || !banner.link_category_id) return null
  const mapa = data?.bannerCategoryProducts as Record<string, any[]> | undefined
  const lista = (mapa?.[String(banner.link_category_id)] || []).slice(0, banner.max_preview_products || 4)
  if (lista.length === 0) return null
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {lista.map((product: any) => {
        const img = fotoProducto(product)
        return (
          <span key={product.id} className="block h-14 w-14 overflow-hidden rounded-lg bg-white/20">
            {img ? <Image src={img} alt={product.name || ''} width={56} height={56} className="h-full w-full object-cover" /> : <Package className="m-auto h-5 w-5 text-white/70" />}
          </span>
        )
      })}
    </div>
  )
}
