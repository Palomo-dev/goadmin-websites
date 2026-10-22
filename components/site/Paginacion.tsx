'use client'

/**
 * Paginación de listas. Sin ajuste (`activo: false`) pinta las mismas clases
 * que la rejilla o la categoría ya tenían. Con ajuste, el estilo elegido.
 * Los números y «Cargar más» son enlaces `?page=N` para que se puedan rastrear.
 */

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  clasesPaginacion,
  claveScroll,
  numerosDePagina,
  urlConPagina,
  type PaginacionResuelta,
} from '@/lib/website/v2/paginacionCarrusel'

export function Paginacion({
  pagina,
  totalPaginas,
  totalItems,
  porPagina,
  resuelta,
  color,
  pathname,
  search,
  onIr,
  hrefDe,
}: {
  pagina: number
  totalPaginas: number
  totalItems?: number
  porPagina: number
  resuelta: PaginacionResuelta
  color: string
  pathname: string
  search: string
  onIr: (n: number) => void
  hrefDe?: (n: number) => string
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const clases = clasesPaginacion(resuelta)
  const href = hrefDe ?? ((n: number) => urlConPagina(pathname, search, n))
  const ir = (n: number, evento?: { preventDefault: () => void }) => {
    evento?.preventDefault()
    try {
      sessionStorage.setItem(claveScroll(window.location.pathname + window.location.search), String(window.scrollY))
    } catch {
      /* modo privado */
    }
    onIr(Math.min(totalPaginas, Math.max(1, n)))
  }

  useEffect(() => {
    if (!resuelta.activo || resuelta.estilo !== 'infinito' || pagina >= totalPaginas) return
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) ir(pagina + 1)
    }, { rootMargin: '240px' })
    obs.observe(el)
    return () => obs.disconnect()
    // ir cambia de identidad; la página es la señal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resuelta.activo, resuelta.estilo, pagina, totalPaginas])

  if (totalPaginas <= 1 && resuelta.estilo !== 'cargar_mas') return null

  const desde = totalItems ? (pagina - 1) * porPagina + 1 : 0
  const hasta = totalItems ? Math.min(pagina * porPagina, totalItems) : 0
  const contador = resuelta.activo && resuelta.mostrarContador && totalItems
    ? `Mostrando ${desde}–${hasta} de ${totalItems}`
    : null
  const numeros = numerosDePagina(pagina, totalPaginas, resuelta.activo ? resuelta.mostrarExtremos : true)
  const estilo = resuelta.activo ? resuelta.estilo : 'numerada'
  const colorActivo = resuelta.colorActivo || color
  const colorInactivo = resuelta.colorInactivo
  const hover = resuelta.colorHover

  const flecha = (direccion: 'anterior' | 'siguiente', destino: number, deshabilitado: boolean) => {
    const etiqueta = direccion === 'anterior'
      ? (resuelta.textoAnterior || 'Anterior')
      : (resuelta.textoSiguiente || 'Siguiente')
    const Icono = direccion === 'anterior' ? ChevronLeft : ChevronRight
    const tam = resuelta.legado === 'categoria' && !resuelta.activo ? 'h-5 w-5' : 'h-4 w-4'
    return (
      <a
        href={deshabilitado ? undefined : href(destino)}
        aria-label={etiqueta}
        aria-disabled={deshabilitado || undefined}
        onClick={(e) => {
          if (deshabilitado) {
            e.preventDefault()
            return
          }
          ir(destino, e)
        }}
        className={`${clases.flecha} ${deshabilitado ? 'pointer-events-none opacity-30' : ''}`}
        style={hover && !deshabilitado ? ({ ['--pagina-hover' as string]: hover }) : undefined}
        onMouseEnter={(e) => {
          if (!deshabilitado && hover) e.currentTarget.style.backgroundColor = hover
        }}
        onMouseLeave={(e) => {
          if (hover) e.currentTarget.style.backgroundColor = ''
        }}
      >
        {resuelta.activo && (direccion === 'anterior' ? resuelta.textoAnterior : resuelta.textoSiguiente)
          ? <span>{etiqueta}</span>
          : <Icono className={tam} aria-hidden="true" />}
      </a>
    )
  }

  const numero = (n: number) => {
    const actual = n === pagina
    return (
      <a
        key={n}
        href={href(n)}
        aria-label={`Página ${n}`}
        aria-current={actual ? 'page' : undefined}
        onClick={(e) => ir(n, e)}
        className={`${clases.numero} inline-flex items-center justify-center ${actual ? 'text-white' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
        style={actual
          ? { backgroundColor: colorActivo, borderColor: colorActivo }
          : colorInactivo ? { color: colorInactivo, borderColor: colorInactivo } : undefined}
      >
        {n}
      </a>
    )
  }

  return (
    <nav aria-label="Paginación" data-paginacion={estilo} data-paginacion-legado={resuelta.activo ? undefined : resuelta.legado} className="mt-2">
      {contador && <p className={`mb-2 text-sm text-gray-500 ${clases.contenedor.includes('justify-start') ? 'text-left' : clases.contenedor.includes('justify-end') ? 'text-right' : 'text-center'}`}>{contador}</p>}
      {estilo === 'compacta' ? (
        <div className={clases.contenedor}>
          {flecha('anterior', pagina - 1, pagina <= 1)}
          <span className="px-2 text-sm text-gray-600 dark:text-gray-300">Página {pagina} de {totalPaginas}</span>
          {flecha('siguiente', pagina + 1, pagina >= totalPaginas)}
        </div>
      ) : estilo === 'anterior_siguiente' ? (
        <div className={clases.contenedor}>
          {flecha('anterior', pagina - 1, pagina <= 1)}
          {flecha('siguiente', pagina + 1, pagina >= totalPaginas)}
        </div>
      ) : estilo === 'cargar_mas' || estilo === 'infinito' ? (
        <div className={clases.contenedor}>
          {pagina < totalPaginas && estilo === 'cargar_mas' && (
            <a
              href={href(pagina + 1)}
              onClick={(e) => ir(pagina + 1, e)}
              className={`${clases.numero} inline-flex items-center justify-center px-4 text-white`}
              style={{ backgroundColor: colorActivo }}
            >
              {resuelta.textoCargarMas || 'Cargar más'}
            </a>
          )}
          {estilo === 'infinito' && <div ref={sentinel} aria-hidden="true" className="h-1 w-full" />}
          <div className="sr-only">
            {Array.from({ length: totalPaginas }, (_, i) => (
              <a key={i + 1} href={href(i + 1)}>Página {i + 1}</a>
            ))}
          </div>
        </div>
      ) : (
        <div className={clases.contenedor}>
          {flecha('anterior', pagina - 1, pagina <= 1)}
          {numeros.map((n, i) => (n === '…'
            ? <span key={`e-${i}`} className="px-1 text-gray-400" aria-hidden="true">...</span>
            : numero(n)))}
          {flecha('siguiente', pagina + 1, pagina >= totalPaginas)}
        </div>
      )}
    </nav>
  )
}
