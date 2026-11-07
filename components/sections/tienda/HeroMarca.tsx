/**
 * Portada `hero · brand_giant` («Marca gigante», plantillas Marea y Contraste; PLANO §3).
 *
 * La marca a todo el ancho, en la letra de los títulos:
 * - `behind_figure` (Marea): la marca detrás de una figura recortada (PNG, `figure_url`) y una
 *   franja abajo con el chip, el texto y el botón.
 * - `over_photo` (Contraste): la marca en blanco encima de la foto (`image_url`), con el texto y el
 *   botón abajo a la izquierda.
 * Puntos sobre la foto (`hotspots`, máx. 4): cada uno abre la ficha de un producto REAL por id.
 *
 * `brand_text` vacío = el nombre de la organización (nunca un nombre fijo). Sin foto ni figura se
 * pinta igual, solo la marca y el texto: es la portada tipográfica.
 *
 * Datos: `data.productosPortada` / `data.products` para el nombre y el uuid del producto de cada
 * punto (precarga de `lib/queries/tienda/portada.ts`). Sin el producto cargado, el punto sigue
 * enlazando por id (la ficha redirige al uuid) con su `label`.
 *
 * Sin 'use client': el manifiesto lee `HeroMarca.CONTENT_KEYS`. Los rótulos de los puntos se
 * muestran con CSS (siempre en escritorio; al enfocar o tocar en el celular); el tamaño de la marca
 * lo ajusta LetreroMarca al ancho real.
 */
import Link from 'next/link'
import { BOTON_PRIMARIO } from '@/lib/website/botonSitio'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { CLAVES_SECCION_TIENDA, normalizarPortadaMarca } from '@/lib/website/v2/contrato/seccionesTienda'
import { productosDePortada, rutaProducto } from '@/lib/website/portadaTienda'
import { estiloSolapa, rutaSede } from './comunPortada'
import { LetreroMarca } from './LetreroMarca'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['hero.brand_giant']

interface Props {
  content: Record<string, unknown>
  organization?: { name?: string; website_settings?: Record<string, unknown> | null } | null
  primaryColor?: string
  data?: Record<string, unknown>
}

export function HeroMarca({ content, organization, primaryColor = '#111111', data }: Props) {
  const p = normalizarPortadaMarca(content)
  const marca = p.brandText || organization?.name || ''
  const sobreFoto = p.brandLayer === 'over_photo'
  const solapa = estiloSolapa(organization, content)
  const productos = productosDePortada(data, p.hotspots.map((h) => h.productId), p.hotspots.length)

  const puntos = p.hotspots.map((h, i) => {
    const producto = productos.find((x) => x.id === h.productId) ?? null
    const nombre = h.label || (typeof producto?.name === 'string' ? producto.name : '')
    return (
      <Link
        key={`${h.productId}-${i}`}
        href={rutaSede(rutaProducto(h.productId, producto), data)}
        aria-label={nombre ? `Ver ${nombre}` : 'Ver el producto'}
        className="group/punto absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 focus:outline-none"
        style={{ left: `${h.x}%`, top: `${h.y}%` }}
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/40 ring-1 ring-white/70 backdrop-blur transition-transform group-hover/punto:scale-110 group-focus-visible/punto:ring-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        {nombre && (
          <span className="pointer-events-none whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover/punto:opacity-100 group-focus-visible/punto:opacity-100 md:opacity-100">
            {nombre}
          </span>
        )}
      </Link>
    )
  })

  const boton = p.ctaText && p.ctaUrl ? (
    <Link
      href={rutaSede(p.ctaUrl, data)}
      {...BOTON_PRIMARIO}
      className="mt-5 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
      style={sobreFoto
        ? { backgroundColor: '#FFFFFF', color: '#111111' }
        : { backgroundColor: primaryColor, color: textoSobreAcentoSiHex(primaryColor) ?? '#FFFFFF', borderRadius: 9999 }}
    >
      {p.ctaText}
    </Link>
  ) : null

  const textos = (p.chip || p.title || boton) && (
    <div className="max-w-md">
      {p.chip && (
        <p
          className={sobreFoto
            ? 'mb-3 inline-block border border-white/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]'
            : 'mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]'}
          style={sobreFoto ? undefined : { color: primaryColor }}
        >
          {p.chip}
        </p>
      )}
      {p.title && (
        <p className={sobreFoto ? 'text-3xl font-medium leading-tight md:text-5xl' : 'text-lg leading-snug md:text-xl'} style={{ fontFamily: sobreFoto ? 'var(--font-heading)' : undefined }}>
          {p.title}
        </p>
      )}
      {boton}
    </div>
  )

  const letrero = <LetreroMarca texto={marca} className={sobreFoto ? 'text-white' : ''} />

  if (sobreFoto) {
    return (
      <div className="relative flex min-h-[560px] flex-col overflow-hidden bg-neutral-800 text-white md:min-h-[680px]" style={solapa} data-portada-tienda="brand_giant">
        {p.imageUrl && <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45" />
        <div className="relative z-10 px-4 pt-6 md:px-8 md:pt-8">{letrero}</div>
        {puntos}
        <div className="relative z-20 mt-auto px-5 pb-8 md:px-10 md:pb-12">{textos}</div>
      </div>
    )
  }

  // behind_figure: la marca arriba, la figura delante y la franja de texto abajo.
  return (
    <div className="relative flex min-h-[560px] flex-col overflow-hidden md:min-h-[680px]" style={solapa} data-portada-tienda="brand_giant">
      {p.imageUrl && <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" />}
      <div className="relative z-10 px-4 pt-8 md:px-8 md:pt-10">{letrero}</div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-0 h-[34%]" style={{ backgroundColor: 'color-mix(in srgb, var(--text-color, #111111) 6%, transparent)' }} />
      {p.figureUrl && (
        <img
          src={p.figureUrl}
          alt=""
          className="pointer-events-none absolute bottom-0 left-1/2 z-20 h-[88%] w-auto max-w-[80%] -translate-x-1/2 object-contain object-bottom"
          loading="eager"
        />
      )}
      {puntos}
      <div className="relative z-30 mt-auto px-5 pb-8 md:px-10 md:pb-12">{textos}</div>
    </div>
  )
}

HeroMarca.CONTENT_KEYS = CONTENT_KEYS
