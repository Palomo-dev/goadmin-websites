import Link from 'next/link'
import { DynamicLucideIcon } from './DynamicLucideIcon'
import { CarruselPastillas } from './CarruselPastillas'
import {
  claseAjuste,
  clasesCirculosMovil,
  clasesPastillas,
  layoutMovilCategorias,
  planBento,
  radioTarjeta,
  sombraTarjeta,
  type EstiloCategoria,
} from '@/lib/website/estiloCategoria'

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
  const hayIcono = typeof cat.icon === 'string' && cat.icon.trim() !== ''
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
  return (
    <span className={`relative flex items-center justify-center overflow-hidden ${clase}`} style={{ backgroundColor: fondo }}>
      {medio === 'imagen' ? (
        <img
          src={cat.image_url}
          alt=""
          className={`h-full w-full ${claseAjuste(fit)} ${zoom ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
        />
      ) : medio === 'icono' ? (
        <DynamicLucideIcon name={cat.icon} fallback="Tag" className={tamanoIcono} style={{ color: cat.color || color }} aria-hidden />
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

function TarjetaAbajo({ cat, color, content }: { cat: any; color: string; content: Contenido }) {
  const ratio = content.image_ratio === '4:3' ? 'aspect-[4/3]' : 'aspect-square'
  const radio = radioTarjeta(content.card_radius, 16)
  const sombra = sombraTarjeta(content.card_shadow, 'shadow-sm')
  const borde = Number(content.card_border_width) > 0
    ? `${Number(content.card_border_width)}px solid ${content.card_border_color || '#e5e7eb'}`
    : undefined
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`group block overflow-hidden bg-white ${sombra} ${content.card_hover === 'lift' ? 'transition-transform hover:-translate-y-1' : ''}`}
      style={{ borderRadius: radio, ...(borde ? { border: borde } : {}) }}
    >
      <Foto content={content} color={color} cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase={`${ratio} p-4`} fondo={fondoSuave(color, content.image_bg)} />
      <div className="bg-gray-50 px-4 py-3 dark:bg-gray-800">
        <p className="font-semibold text-gray-900 dark:text-white">{cat.name}</p>
        <p className="mt-1 text-sm" style={{ color }}>Ver productos →</p>
        {content.show_count && cat.product_count != null && (
          <p className="text-xs text-gray-500">{cat.product_count} productos</p>
        )}
      </div>
    </Link>
  )
}

function Pastilla({ cat, color, content, snap = false, bloque = false }: { cat: any; color: string; content: Contenido; snap?: boolean; bloque?: boolean }) {
  // Hover solo con CSS y solo donde hay mouse (`hover:hover`): en el celular no queda pintada.
  const estilo = {
    '--pastilla-hover': color,
    ...(content.card_bg ? { backgroundColor: content.card_bg } : {}),
    ...(content.overlay_text_color ? { color: content.overlay_text_color } : {}),
  } as React.CSSProperties
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className={`group ${bloque ? 'flex w-full min-w-0 md:inline-flex md:w-auto' : 'inline-flex'} shrink-0${snap ? ' snap-start' : ''} items-center gap-2 rounded-full border border-gray-200 ${content.card_bg ? '' : 'bg-white '}py-1 pl-1 pr-4 ${content.overlay_text_color ? '' : 'text-gray-900 '}transition [@media(hover:hover)]:hover:border-transparent [@media(hover:hover)]:hover:!bg-[var(--pastilla-hover)] [@media(hover:hover)]:hover:!text-white`}
      style={estilo}
    >
      <Foto content={content} color={color} cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase="h-10 w-10 shrink-0 rounded-full" fondo={fondoSuave(color, content.image_bg)} />
      <span className={`text-sm font-medium [@media(hover:hover)]:group-hover:text-white${bloque ? ' min-w-0 truncate' : ''}`}>{cat.name}</span>
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
      <CarruselPastillas clases={clasesPastillas('carousel', content.mobile_layout)}>
        {categorias.map((cat) => <Pastilla key={cat.id} cat={cat} color={color} content={content} snap bloque={bloque} />)}
      </CarruselPastillas>
    ) : (
      <div className={clasesPastillas(content.desktop_layout, content.mobile_layout)} style={{ scrollbarWidth: 'none' }}>
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
  } else {
    cuerpo = (
      <>
        <div className="grid grid-cols-2 gap-4 md:hidden">
          {categorias.map((cat) => <TarjetaAbajo key={cat.id} cat={cat} color={color} content={content} />)}
        </div>
        <div className="hidden gap-6 md:grid" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {categorias.map((cat) => <TarjetaAbajo key={cat.id} cat={cat} color={color} content={content} />)}
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
