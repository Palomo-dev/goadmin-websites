import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { IconoCategoria } from './IconoCategoria'
import { colorIconoCategoria, estiloFondoIcono, fondoIconoCategoria, tieneIconoCategoria } from '@/lib/website/iconosCategoria'
import { CarruselPastillas } from './CarruselPastillas'
import {
  claseAjuste,
  clasesCirculosMovil,
  clasesPastillas,
  colorDeCategoria,
  proporcionTituloArriba,
  textoSobreColor,
  layoutMovilCategorias,
  MASCARA_CARRIL,
  planBento,
  radioTarjeta,
  sombraTarjeta,
  type EstiloCategoria,
} from '@/lib/website/estiloCategoria'
import {
  DEFAULT_AJUSTES_CATEGORIAS,
  normalizarAjustesCategorias,
  type AjustesCategorias,
} from '@/lib/website/v2/contrato/seccionesTienda'

interface Contenido {
  title?: string
  subtitle?: string
  show_count?: boolean
  show_view_all?: boolean
  view_all_url?: string
  view_all_label?: string
  image_fit?: string
  image_bg?: string
  image_ratio?: string
  card_radius?: number
  card_shadow?: string
  card_border_width?: number
  card_border_color?: string
  card_hover?: string
  desktop_columns?: number
  desktop_layout?: string
  mobile_layout?: string
  card_bg?: string
  overlay_text_color?: string
  media_source?: string
  show_icon?: boolean
  show_image?: boolean
  /** Pastillas en escritorio: 'center' (por defecto) o 'left'. */
  align?: string
  /** 'category' | 'primary' | 'secondary' | '#hex'. Ausente: el color de la categoría, como hoy. */
  icon_color?: string
  /** 'soft' | 'solid' | 'none'. Ausente: el fondo de hoy. */
  icon_bg_mode?: string
}

interface Props {
  categorias: any[]
  estilo: EstiloCategoria
  primaryColor: string
  content: Contenido
}

function fondoSuave(color: string, explicito?: string): string {
  if (explicito && explicito.trim()) return explicito
  return `color-mix(in srgb, ${color} 14%, white)`
}

/**
 * Medio de la categoría (paquete 5-nov D2). Respeta «Origen del medio» (`media_source`):
 * - `icon`: el ícono de la categoría (`cat.icon`); `image`: la foto; `initial`: la inicial;
 *   `color`: solo el fondo.
 * - `auto` (o vacío): la foto si hay (y `show_image` no está apagado); si no, el ícono; si
 *   tampoco, la etiqueta de siempre. `preferirIcono` («Ícono suave») pone el ícono primero.
 */
function Foto({ cat, fit, zoom, clase, fondo, content, color, preferirIcono = false }: { cat: any; fit: string; zoom: boolean; clase: string; fondo: string; content?: Contenido; color?: string; preferirIcono?: boolean }) {
  const origen = content?.media_source || 'auto'
  const hayImagen = Boolean(cat.image_url) && content?.show_image !== false
  // Propio (`categories.icon`) o automático por el nombre (iconosCategoria.ts).
  const hayIcono = tieneIconoCategoria(cat)
  let medio: 'imagen' | 'icono' | 'inicial' | 'nada' | 'etiqueta'
  if (origen === 'icon') medio = 'icono'
  else if (origen === 'image') medio = cat.image_url ? 'imagen' : hayIcono ? 'icono' : 'etiqueta'
  else if (origen === 'initial') medio = 'inicial'
  else if (origen === 'color') medio = 'nada'
  else if (preferirIcono && hayIcono) medio = 'icono'
  else if (hayImagen) medio = 'imagen'
  else if (hayIcono) medio = 'icono'
  else if (preferirIcono && cat.image_url) medio = 'imagen'
  else medio = 'etiqueta'
  const tamanoIcono = /h-(10|7|8)\b/.test(clase) ? 'h-5 w-5' : 'h-1/3 w-1/3 min-h-6 min-w-6 max-h-12 max-w-12'
  // Color y fondo del ícono de la sección (icon_color, icon_bg_mode); sin ellos, los de hoy.
  const colorBase = colorIconoCategoria(content, { categoria: cat.color, primario: color || '#111827' }) ?? (cat.color || color)
  const modoFondo = medio === 'icono' ? fondoIconoCategoria(content) : null
  const conModo = modoFondo ? estiloFondoIcono(modoFondo, colorBase || '#111827', content?.image_bg) : null
  return (
    <span className={`relative flex items-center justify-center overflow-hidden ${clase}`} style={{ backgroundColor: conModo ? conModo.fondo : fondo }}>
      {medio === 'imagen' ? (
        <img
          src={cat.image_url}
          alt=""
          className={`h-full w-full ${claseAjuste(fit)} ${zoom ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
        />
      ) : medio === 'icono' ? (
        <IconoCategoria cat={cat} className={tamanoIcono} style={{ color: conModo ? conModo.colorIcono : colorBase }} aria-hidden />
      ) : medio === 'inicial' ? (
        <span className="text-xl font-bold" style={{ color: cat.color || color }} aria-hidden>{String(cat.name || '?').trim().charAt(0).toUpperCase()}</span>
      ) : medio === 'nada' ? null : (
        <span className="text-2xl" aria-hidden>🏷️</span>
      )}
    </span>
  )
}

function Circulo({ cat, color, content, fila = false, ancho = false }: { cat: any; color: string; content: Contenido; fila?: boolean; ancho?: boolean }) {
  const zoom = content.card_hover === 'zoom'
  const anillo = content.card_hover !== 'none'
  const colorTexto = content.overlay_text_color ? { color: content.overlay_text_color } : undefined
  const caja = fila
    ? 'group flex w-full min-w-0 flex-row items-center gap-3 text-left'
    : `group flex ${ancho ? 'w-full min-w-0' : 'w-36 shrink-0'} flex-col items-center text-center`
  return (
    <Link href={`/categorias/${cat.slug}`} className={`${caja} ${content.card_hover === 'lift' ? 'transition-transform [@media(hover:hover)]:hover:-translate-y-1' : ''}`}>
      <Foto
        content={content}
        color={color}
        cat={cat}
        fit={content.image_fit || 'contain'}
        zoom={zoom}
        clase={`${fila ? 'h-14 w-14 shrink-0' : 'h-28 w-28'} rounded-full ${anillo ? 'ring-2 ring-transparent transition [@media(hover:hover)]:group-hover:ring-[var(--accent-color)]' : ''}`}
        fondo={fondoSuave(color, content.image_bg)}
      />
      <span className={fila ? 'min-w-0' : undefined}>
        <span className={`${fila ? 'block truncate' : 'mt-3 block'} text-sm font-semibold text-gray-900 dark:text-white`} style={colorTexto}>{cat.name}</span>
        {content.show_count && cat.product_count != null && (
          <span className="block text-xs text-gray-500">{cat.product_count} productos</span>
        )}
      </span>
    </Link>
  )
}

/** Flecha en círculo sobre la esquina de la foto (`category_cta_icon: 'arrow_circle'`). */
function FlechaCirculo() {
  return (
    <span className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-900 shadow-sm transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:-translate-y-0.5" aria-hidden>
      <ArrowUpRight className="h-4 w-4" />
    </span>
  )
}

/**
 * «Tarjeta abajo». Con los ajustes por defecto (`bottom` / `none` / `none`) es la tarjeta de
 * siempre, clase por clase (lo compara verify:categoria-plantilla). Las opciones nuevas:
 * - `textPosition: 'top'`: el pie va encima de la foto.
 * - `cardColor: 'per_item'`: el pie toma `categories.color` y el texto se ajusta al contraste.
 * - `ctaIcon`: `arrow` = flecha al lado del nombre; `arrow_circle` = flecha en círculo sobre la
 *   foto. Las dos reemplazan el rótulo «Ver productos →».
 */
function TarjetaAbajo({ cat, color, content, ajustes = DEFAULT_AJUSTES_CATEGORIAS }: { cat: any; color: string; content: Contenido; ajustes?: AjustesCategorias }) {
  const ratio = content.image_ratio === '4:3' ? 'aspect-[4/3]' : 'aspect-square'
  const radio = radioTarjeta(content.card_radius, 16)
  const sombra = sombraTarjeta(content.card_shadow, 'shadow-sm')
  const borde = Number(content.card_border_width) > 0
    ? `${Number(content.card_border_width)}px solid ${content.card_border_color || '#e5e7eb'}`
    : undefined
  const colorPie = ajustes.cardColor === 'per_item' ? colorDeCategoria(cat.color) : null
  const textoPie = colorPie ? textoSobreColor(colorPie) : null
  const foto = <Foto content={content} color={color} cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase={`${ratio} p-4`} fondo={fondoSuave(color, content.image_bg)} />
  const conteo = content.show_count && cat.product_count != null
  let pie: React.ReactNode
  if (ajustes.ctaIcon === 'none') {
    pie = colorPie ? (
      <div className="px-4 py-3" style={{ backgroundColor: colorPie, color: textoPie ?? undefined }}>
        <p className="font-semibold">{cat.name}</p>
        <p className="mt-1 text-sm opacity-80">Ver productos →</p>
        {conteo && <p className="text-xs opacity-70">{cat.product_count} productos</p>}
      </div>
    ) : (
      <div className="bg-gray-50 px-4 py-3 dark:bg-gray-800">
        <p className="font-semibold text-gray-900 dark:text-white">{cat.name}</p>
        <p className="mt-1 text-sm" style={{ color }}>Ver productos →</p>
        {content.show_count && cat.product_count != null && (
          <p className="text-xs text-gray-500">{cat.product_count} productos</p>
        )}
      </div>
    )
  } else {
    // Con flecha: nombre y conteo en una fila (el conteo a la derecha con flecha en círculo).
    const claseConteo = colorPie ? 'text-xs opacity-70' : 'text-xs text-gray-500'
    pie = (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 ${colorPie ? '' : 'bg-gray-50 dark:bg-gray-800'}`}
        style={colorPie ? { backgroundColor: colorPie, color: textoPie ?? undefined } : undefined}
      >
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${colorPie ? '' : 'text-gray-900 dark:text-white'}`}>{cat.name}</span>
          {conteo && ajustes.ctaIcon === 'arrow' && <span className={`block ${claseConteo}`}>{cat.product_count} productos</span>}
        </span>
        {ajustes.ctaIcon === 'arrow' ? (
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5" style={colorPie ? undefined : { color }} aria-hidden />
        ) : (
          conteo && <span className={`shrink-0 ${claseConteo}`}>{cat.product_count} productos</span>
        )}
      </div>
    )
  }
  const medio = ajustes.ctaIcon === 'arrow_circle' ? <div className="relative">{foto}<FlechaCirculo /></div> : foto
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`group block overflow-hidden bg-white ${sombra} ${content.card_hover === 'lift' ? 'transition-transform hover:-translate-y-1' : ''}`}
      style={{ borderRadius: radio, ...(borde ? { border: borde } : {}) }}
    >
      {ajustes.textPosition === 'top' ? <>{pie}{medio}</> : <>{medio}{pie}</>}
    </Link>
  )
}

/**
 * «Título arriba» (`category_style: 'title_top'`, plantillas de tienda): nombre encima de la
 * foto; debajo el conteo, «Explorar →» y la descripción (`categories.description`), si la hay.
 * Radio 0 por defecto (`card_radius` lo cambia). `cardColor: 'per_item'` pinta el fondo de la
 * foto con `categories.color`; `ctaIcon: 'arrow_circle'` pone la flecha sobre la foto.
 */
function TituloArriba({ cat, color, content, ajustes }: { cat: any; color: string; content: Contenido; ajustes: AjustesCategorias }) {
  const radio = radioTarjeta(content.card_radius, 0)
  const colorFondo = ajustes.cardColor === 'per_item' ? colorDeCategoria(cat.color) : null
  const colorTexto = content.overlay_text_color ? { color: content.overlay_text_color } : undefined
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`group block min-w-0 ${content.card_hover === 'lift' ? 'transition-transform [@media(hover:hover)]:hover:-translate-y-1' : ''}`}
    >
      <h3 className="mb-3 truncate text-center text-2xl font-normal text-gray-900 dark:text-white md:text-3xl" style={colorTexto}>{cat.name}</h3>
      <div className="relative overflow-hidden" style={{ borderRadius: radio }}>
        <Foto
          content={content}
          color={color}
          cat={cat}
          fit={content.image_fit || 'contain'}
          zoom={content.card_hover !== 'none'}
          clase={`${proporcionTituloArriba(content.image_ratio)} w-full`}
          fondo={colorFondo ?? fondoSuave(color, content.image_bg)}
        />
        {ajustes.ctaIcon === 'arrow_circle' && <FlechaCirculo />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {content.show_count && cat.product_count != null ? `${cat.product_count} productos` : ''}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-gray-900 dark:text-white">
          Explorar
          <ArrowRight className="h-3.5 w-3.5 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
      {cat.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{cat.description}</p>
      )}
    </Link>
  )
}

function Pastilla({ cat, color, content, snap = false, bloque = false }: { cat: any; color: string; content: Contenido; snap?: boolean; bloque?: boolean }) {
  // Hover solo con CSS y solo donde hay mouse (`hover:hover`): en el celular no queda pintada.
  // En bloque (celular en grilla o lista) el nombre va en hasta 2 líneas, no truncado: la grilla
  // estira cada pastilla a la altura de la más alta de su fila. Desde md, una línea como siempre.
  const estilo = {
    '--pastilla-hover': color,
    ...(content.card_bg ? { backgroundColor: content.card_bg } : {}),
    ...(content.overlay_text_color ? { color: content.overlay_text_color } : {}),
  } as React.CSSProperties
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`group ${bloque ? 'flex w-full min-w-0 md:inline-flex md:w-auto' : 'inline-flex'} shrink-0${snap ? ' snap-start' : ''} items-center gap-2 ${bloque ? 'rounded-3xl md:rounded-full' : 'rounded-full'} border border-gray-200 ${content.card_bg ? '' : 'bg-white '}${bloque ? 'py-1.5 md:py-1' : 'py-1'} pl-1 pr-4 ${content.overlay_text_color ? '' : 'text-gray-900 '}transition [@media(hover:hover)]:hover:border-transparent [@media(hover:hover)]:hover:!bg-[var(--pastilla-hover)] [@media(hover:hover)]:hover:!text-white`}
      style={estilo}
    >
      <Foto content={content} color={color} cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase="h-10 w-10 shrink-0 rounded-full" fondo={fondoSuave(color, content.image_bg)} />
      <span className={`text-sm font-medium [@media(hover:hover)]:group-hover:text-white${bloque ? ' min-w-0 line-clamp-2 break-words leading-tight text-left md:line-clamp-none md:whitespace-nowrap md:leading-5' : ''}`}>{cat.name}</span>
    </Link>
  )
}

function Minimo({ cat, color, content }: { cat: any; color: string; content: Contenido }) {
  const radio = radioTarjeta(content.card_radius, 16)
  const sombra = sombraTarjeta(content.card_shadow, '')
  const bordeHover = content.card_hover !== 'none'
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`group block px-4 py-5 text-center ${sombra} ${bordeHover ? 'border border-transparent transition hover:border-gray-400' : ''} ${content.card_hover === 'lift' ? 'hover:-translate-y-1' : ''}`}
      style={{ borderRadius: radio, backgroundColor: fondoSuave(color, content.image_bg) }}
    >
      <Foto content={content} color={color} cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase="mx-auto h-24 w-24 bg-transparent" fondo="transparent" preferirIcono />
      <p className="mt-3 font-bold text-gray-900 dark:text-white">{cat.name}</p>
      {content.show_count && cat.product_count != null && (
        <p className="text-xs text-gray-500">{cat.product_count} productos</p>
      )}
    </Link>
  )
}

function CeldaBento({ cat, color, content, grande }: { cat: any; color: string; content: Contenido; grande: boolean }) {
  const radio = radioTarjeta(content.card_radius, 16)
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`group relative block overflow-hidden ${grande ? 'col-span-2 row-span-2 min-h-[220px]' : 'min-h-[104px]'}`}
      style={{ borderRadius: radio }}
    >
      <Foto content={content} color={color} cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase="absolute inset-0" fondo={fondoSuave(color, content.image_bg)} />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/0" />
      <span className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white">{cat.name}</span>
    </Link>
  )
}

export function EstilosCategoria({ categorias, estilo, primaryColor, content }: Props) {
  const color = primaryColor || '#111827'
  const columnas = Math.min(6, Math.max(2, Number(content.desktop_columns) || 4))
  const carrusel = content.desktop_layout === 'carousel'
  const movil = layoutMovilCategorias(content.mobile_layout)
  const bloque = movil !== 'carousel'
  // Opciones de las plantillas de tienda (category_text_position, category_card_color,
  // category_cta_icon). Ausentes = `bottom` / `none` / `none`: la tarjeta de hoy.
  const ajustes = normalizarAjustesCategorias(content as Record<string, unknown>)
  let cuerpo: React.ReactNode

  if (estilo === 'circle') {
    cuerpo = (
      <>
        <div className={clasesCirculosMovil(content.mobile_layout)} style={{ scrollbarWidth: 'none' }}>
          {categorias.map((cat) => <Circulo key={cat.id} cat={cat} color={color} content={content} fila={movil === 'list'} ancho={movil === 'grid'} />)}
        </div>
        <div className={carrusel ? 'hidden gap-4 overflow-x-auto md:flex' : 'hidden gap-6 md:grid'} style={carrusel ? { scrollbarWidth: 'none' } : { gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {categorias.map((cat) => <Circulo key={cat.id} cat={cat} color={color} content={content} />)}
        </div>
      </>
    )
  } else if (estilo === 'pill') {
    cuerpo = carrusel ? (
      <CarruselPastillas clases={clasesPastillas('carousel', content.mobile_layout, content.align)}>
        {categorias.map((cat) => <Pastilla key={cat.id} cat={cat} color={color} content={content} snap bloque={bloque} />)}
      </CarruselPastillas>
    ) : (
      <div className={clasesPastillas(content.desktop_layout, content.mobile_layout, content.align)} style={{ scrollbarWidth: 'none' }}>
        {categorias.map((cat) => <Pastilla key={cat.id} cat={cat} color={color} content={content} bloque={bloque} />)}
      </div>
    )
  } else if (estilo === 'bento') {
    const plan = planBento(categorias.length)
    const usados = plan.reduce((s, n) => s + n, 0)
    const resto = categorias.slice(usados)
    let cursor = 0
    cuerpo = (
      <>
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {categorias.map((cat, i) => (
            <div key={cat.id ?? i} className={i % 5 === 0 ? 'col-span-2' : ''}>
              <CeldaBento cat={cat} color={color} content={content} grande={false} />
            </div>
          ))}
        </div>
        <div className="hidden flex-col gap-3 md:flex">
          {plan.map((tamano, grupo) => {
            const trozo = categorias.slice(cursor, cursor + tamano)
            cursor += tamano
            return (
              <div key={grupo} className="grid grid-cols-4 gap-3">
                {trozo.map((cat, i) => (
                  <CeldaBento key={cat.id ?? i} cat={cat} color={color} content={content} grande={tamano === 5 && i === 0} />
                ))}
              </div>
            )
          })}
          {resto.length > 0 && (
            // Paquete 5-nov D3: las que no completan un grupo de 5 u 8 van en un bloque final
            // de celdas chicas; nunca se esconden.
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(resto.length, 2))}, minmax(0, 1fr))` }}>
              {resto.map((cat, i) => (
                <CeldaBento key={cat.id ?? `resto-${i}`} cat={cat} color={color} content={content} grande={false} />
              ))}
            </div>
          )}
        </div>
      </>
    )
  } else if (estilo === 'minimal_icon') {
    cuerpo = (
      <>
        <div className="grid grid-cols-2 gap-4 md:hidden">
          {categorias.map((cat) => <Minimo key={cat.id} cat={cat} color={color} content={content} />)}
        </div>
        <div className="hidden gap-6 md:grid" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {categorias.map((cat) => <Minimo key={cat.id} cat={cat} color={color} content={content} />)}
        </div>
      </>
    )
  } else if (estilo === 'title_top') {
    // Celular: `mobile_layout` carril (por defecto), 2 columnas o lista; escritorio: columnas.
    const claseMovil = movil === 'grid'
      ? 'grid grid-cols-2 gap-4 md:hidden'
      : movil === 'list'
        ? 'flex flex-col gap-8 md:hidden'
        : `flex gap-4 overflow-x-auto snap-x pb-2 md:hidden ${MASCARA_CARRIL}`
    cuerpo = (
      <>
        <div className={claseMovil} style={movil === 'carousel' ? { scrollbarWidth: 'none' } : undefined}>
          {categorias.map((cat) => (
            <div key={cat.id} className={movil === 'carousel' ? 'w-[72%] shrink-0 snap-start' : 'min-w-0'}>
              <TituloArriba cat={cat} color={color} content={content} ajustes={ajustes} />
            </div>
          ))}
        </div>
        <div className="hidden gap-8 md:grid" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {categorias.map((cat) => <TituloArriba key={cat.id} cat={cat} color={color} content={content} ajustes={ajustes} />)}
        </div>
      </>
    )
  } else {
    cuerpo = (
      <>
        <div className="grid grid-cols-2 gap-4 md:hidden">
          {categorias.map((cat) => <TarjetaAbajo key={cat.id} cat={cat} color={color} content={content} ajustes={ajustes} />)}
        </div>
        <div className="hidden gap-6 md:grid" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {categorias.map((cat) => <TarjetaAbajo key={cat.id} cat={cat} color={color} content={content} ajustes={ajustes} />)}
        </div>
      </>
    )
  }

  return (
    <div>
      {content.title && (
        <h2 className="mb-3 text-center text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">{content.title}</h2>
      )}
      {content.subtitle && <p className="mb-8 text-center text-gray-600 dark:text-gray-300">{content.subtitle}</p>}
      {cuerpo}
      {content.show_view_all === true && (
        <div className="mt-8 text-center">
          <Link href={content.view_all_url || '/categorias'} className="inline-flex items-center font-semibold" style={{ color }}>
            {content.view_all_label || 'Ver todo'}
          </Link>
        </div>
      )}
    </div>
  )
}
