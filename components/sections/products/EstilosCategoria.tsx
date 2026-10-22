import Link from 'next/link'
import {
  claseAjuste,
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

function Foto({ cat, fit, zoom, clase, fondo }: { cat: any; fit: string; zoom: boolean; clase: string; fondo: string }) {
  return (
    <span className={`relative flex items-center justify-center overflow-hidden ${clase}`} style={{ backgroundColor: fondo }}>
      {cat.image_url ? (
        <img
          src={cat.image_url}
          alt=""
          className={`h-full w-full ${claseAjuste(fit)} ${zoom ? 'transition-transform duration-300 group-hover:scale-105' : ''}`}
        />
      ) : (
        <span className="text-2xl" aria-hidden>🏷️</span>
      )}
    </span>
  )
}

function Circulo({ cat, color, content }: { cat: any; color: string; content: Contenido }) {
  const zoom = content.card_hover === 'zoom'
  const anillo = content.card_hover !== 'none'
  return (
    <Link href={`/categorias/${cat.slug}`} className={`group flex w-36 shrink-0 flex-col items-center text-center ${content.card_hover === 'lift' ? 'transition-transform hover:-translate-y-1' : ''}`}>
      <Foto
        cat={cat}
        fit={content.image_fit || 'contain'}
        zoom={zoom}
        clase={`h-28 w-28 rounded-full ${anillo ? 'ring-2 ring-transparent transition group-hover:ring-[var(--accent-color)]' : ''}`}
        fondo={fondoSuave(color, content.image_bg)}
      />
      <span className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{cat.name}</span>
      {content.show_count && cat.product_count != null && (
        <span className="text-xs text-gray-500">{cat.product_count} productos</span>
      )}
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
      <Foto cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase={`${ratio} p-4`} fondo={fondoSuave(color, content.image_bg)} />
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

function Pastilla({ cat, color, content }: { cat: any; color: string; content: Contenido }) {
  return (
    <Link
      href={`/categorias/${cat.slug}`}
      className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-4 text-gray-900 transition hover:border-transparent hover:text-white"
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = color; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '' }}
    >
      <Foto cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase="h-10 w-10 rounded-full" fondo={fondoSuave(color, content.image_bg)} />
      <span className="text-sm font-medium group-hover:text-white">{cat.name}</span>
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
      <Foto cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase="mx-auto h-24 w-24 bg-transparent" fondo="transparent" />
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
      <Foto cat={cat} fit={content.image_fit || 'contain'} zoom={content.card_hover === 'zoom'} clase="absolute inset-0" fondo={fondoSuave(color, content.image_bg)} />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/0" />
      <span className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white">{cat.name}</span>
    </Link>
  )
}

export function EstilosCategoria({ categorias, estilo, primaryColor, content }: Props) {
  const color = primaryColor || '#111827'
  const columnas = Math.min(6, Math.max(2, Number(content.desktop_columns) || 4))
  const carrusel = content.desktop_layout === 'carousel'
  let cuerpo: React.ReactNode

  if (estilo === 'circle') {
    cuerpo = (
      <>
        <div className="flex gap-4 overflow-x-auto pb-2 md:hidden" style={{ scrollbarWidth: 'none' }}>
          {categorias.map((cat) => <Circulo key={cat.id} cat={cat} color={color} content={content} />)}
        </div>
        <div className={carrusel ? 'hidden gap-4 overflow-x-auto md:flex' : 'hidden gap-6 md:grid'} style={carrusel ? { scrollbarWidth: 'none' } : { gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {categorias.map((cat) => <Circulo key={cat.id} cat={cat} color={color} content={content} />)}
        </div>
      </>
    )
  } else if (estilo === 'pill') {
    cuerpo = (
      <div className="flex gap-3 overflow-x-auto pb-2 md:flex-wrap" style={{ scrollbarWidth: 'none' }}>
        {categorias.map((cat) => <Pastilla key={cat.id} cat={cat} color={color} content={content} />)}
      </div>
    )
  } else if (estilo === 'bento') {
    const plan = planBento(categorias.length)
    const usados = plan.reduce((s, n) => s + n, 0)
    let cursor = 0
    cuerpo = (
      <>
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {categorias.slice(0, usados).map((cat, i) => (
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
