'use client'
import { IconoConCirculo } from './header/IconoEncabezado'

import { useState, useEffect, useRef, type ComponentType, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, TrendingUp, Clock, Package } from 'lucide-react'
import Link from '@/components/site/Enlace'
import Image from 'next/image'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { urlResultadosBusqueda } from '@/lib/products/urlBusqueda'
import { useBusquedasRecientes, useCerrarBuscador, usePosicionPanel, useResultadosBusqueda, type ResultadoBusqueda } from './buscador/comportamiento'
import { useEncabezadoPie } from './EncabezadoPieContext'
import { ContenedorIcono, trazoContenedor, type ColoresCaja } from './header/ContenedorIcono'
import type { ContenedorIconos } from '@/lib/website/constructorEncabezado'
import { useAparienciaBuscador } from './buscador/AparienciaBuscadorContext'
import { CLASES_CAJA_APARIENCIA, CLASES_CAMPO_APARIENCIA } from './buscador/clasesApariencia'
import { PanelFlotanteEncabezado } from './header/PanelFlotanteEncabezado'
import { lupaSoloDibujo } from './iconos/GlifoTienda'
import {
  SOMBRA_DESPLEGABLE_CSS,
  estiloCajaApariencia,
  rellenoCampo,
  resolverApariencia,
  variablesApariencia,
  type AparienciaResuelta,
} from '@/lib/website/v2/aparienciaBuscador'

interface ProductSearchProps {
  primaryColor: string
  icon?: any
  /** El ícono hereda `--header-fg` de la barra. En el panel de resultados sigue el gris. */
  heredarColor?: boolean
  /**
   * El menú inferior abre el mismo panel. `true` lo muestra; al cerrar se avisa
   * con `alCerrar`. Sin estas props el botón del encabezado lo controla solo.
   */
  abierto?: boolean
  alCerrar?: () => void
  /** Sin el botón redondo: quien abre ya tiene el suyo (la pestaña Buscar). */
  sinDisparador?: boolean
  /** Pantalla completa también en tablet. El menú móvil llega hasta el breakpoint del sitio, no solo hasta `md`. */
  pantallaCompleta?: boolean
  /** Caja del ícono. Sin ella el botón de buscar se pinta igual que hoy. */
  contenedor?: ContenedorIconos | null
  colores?: ColoresCaja
  /** Clase del ícono disparador. En el celular, `--hdr-mobile-icon`. */
  claseIcono?: string
  /** «Círculo acento» del encabezado, igual que moneda, carrito y cuenta. */
  circulo?: boolean
}

type SearchResult = ResultadoBusqueda


export function ProductSearch({
  primaryColor,
  icon: SearchIconComp = Search,
  heredarColor = false,
  abierto,
  alCerrar,
  sinDisparador = false,
  pantallaCompleta = false,
  contenedor = null,
  colores,
  claseIcono,
  circulo = false,
}: ProductSearchProps) {
  const { ruta } = useRutaSitio()
  // Populares: las de la tienda (search_popular) o sus primeras categorías del menú; nunca genéricas.
  const { busquedasPopulares: popularSearches } = useEncabezadoPie()
  // Formas «Ícono» e «Ícono que abre encima»: la apariencia (si la hay) va al campo que se abre y al
  // desplegable; el ícono suelto sigue el estilo de «Íconos». Sin apariencia, lo de hoy.
  const ctxApariencia = useAparienciaBuscador()
  // El disparador es un ícono suelto (toma el fondo, la sombra y el tamaño del «Estilo de los
  // íconos»); la lupa del campo que se abre va dentro de una barra: solo el dibujo.
  const LupaCampo = lupaSoloDibujo(SearchIconComp)
  const ap = ctxApariencia
    ? resolverApariencia(ctxApariencia.apariencia, 'icon', { primary: primaryColor }, pantallaCompleta ? 'celular' : ctxApariencia.dispositivo)
    : null
  const controlado = abierto !== undefined
  const [interno, setInterno] = useState(false)
  const isOpen = controlado ? abierto : interno
  const cerrar = () => {
    if (controlado) alCerrar?.()
    else setInterno(false)
  }
  const alternar = () => {
    if (controlado) {
      if (isOpen) alCerrar?.()
      return
    }
    setInterno((v) => !v)
  }
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mobilePortalRef = useRef<HTMLDivElement>(null)
  // Panel de escritorio fuera del <header> (PanelFlotanteEncabezado): el clic adentro no cierra.
  const panelRef = useRef<HTMLDivElement>(null)
  // Comportamiento común con la barra (components/site/buscador/comportamiento.ts): resultados
  // desde 2 caracteres, recientes, cierre por clic afuera y Escape en todo el documento.
  const { resultados: results, cargando: loading, sugiere } = useResultadosBusqueda(query)
  const { recientes: recentSearches, guardar: saveRecentSearch } = useBusquedasRecientes(!!isOpen)
  useCerrarBuscador(!!isOpen, cerrar, [containerRef, mobilePortalRef, panelRef])
  // Panel de escritorio: 384px (w-96) pegado al borde derecho de la lupa y siempre dentro de la pantalla.
  const posicion = usePosicionPanel(!!isOpen && !pantallaCompleta, containerRef, { ancho: 384, minimo: 320, alinear: 'derecha' })

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleResultClick = (product: SearchResult) => {
    saveRecentSearch(product.name)
    cerrar()
    setQuery('')
  }

  // Enter: a los resultados (/search), igual que la barra.
  const handleSearchSubmit = (term: string) => {
    if (term.trim()) {
      saveRecentSearch(term.trim())
      window.location.href = ruta(urlResultadosBusqueda(term.trim()))
    }
  }

  const renderContent = () => (
    <div className="flex-1 overflow-y-auto p-4">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300" style={{ borderTopColor: primaryColor }} />
        </div>
      )}

      {!loading && sugiere && results.length > 0 && (
        <div className="space-y-1">
          {results.map((product) => (
            <Link
              key={product.id}
              href={ruta(`/productos/${product.uuid}`)}
              onClick={() => handleResultClick(product)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {ap?.desplegableImagenes !== false && <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden relative flex-shrink-0">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="48px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-5 w-5 text-gray-300" />
                  </div>
                )}
              </div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                {ap?.desplegablePrecios !== false && <div className="flex items-center gap-2 mt-0.5">
                  {product.price && (
                    <span className="text-sm font-bold" style={{ color: primaryColor }}>
                      ${Number(product.price).toLocaleString('es-CO')}
                    </span>
                  )}
                  {product.comparePrice && product.price && Number(product.comparePrice) > Number(product.price) && (
                    <span className="text-xs text-gray-400 line-through">
                      ${Number(product.comparePrice).toLocaleString('es-CO')}
                    </span>
                  )}
                </div>}
                {(product.category || product.tag) && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {product.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {product.category}
                      </span>
                    )}
                    {product.tag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        {product.tag}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && sugiere && results.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No se encontraron productos para &quot;{query}&quot;</p>
        </div>
      )}

      {!query && (
        <div className="space-y-6">
          {recentSearches.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Recientes
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="px-3 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          {popularSearches.length > 0 && (
          <div data-busquedas-populares="">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Populares
            </p>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div ref={containerRef} className={sinDisparador ? 'contents' : 'relative'}>
      {!sinDisparador && (
        <button
          onClick={alternar}
          className="p-2 rounded-full hover:bg-[var(--header-hover)] transition-colors"
          aria-label="Buscar productos"
        >
          {contenedor ? (
            <ContenedorIcono base={contenedor} clave="search" colores={colores || { primary: primaryColor, accent: primaryColor, secondary: primaryColor }}>
              <SearchIconComp style={trazoContenedor(contenedor, 'search')} />
            </ContenedorIcono>
          ) : (
            <IconoConCirculo circulo={circulo} primaryColor={primaryColor}>
              <SearchIconComp className={claseIcono ?? (circulo || heredarColor ? 'h-5 w-5 text-current' : 'h-5 w-5 text-gray-700 dark:text-gray-300')} />
            </IconoConCirculo>
          )}
        </button>
      )}

      {/* Desktop: dropdown. En el menú móvil va pantalla completa: ese menú se usa también en tablet.
          En la cabecera va en su capa, fuera del <header> (PanelFlotanteEncabezado). */}
      <PanelFlotanteEncabezado
        abierto={!!isOpen && !pantallaCompleta}
        ancla={containerRef}
        posicion={posicion}
        alinear="derecha"
        refPanel={panelRef}
        className="hidden md:block"
        enLinea={{
          className: `absolute top-full mt-2 z-[100]${posicion ? '' : ' right-0'}`,
          style: posicion ? { left: posicion.left, width: posicion.width } : undefined,
        }}
          data-panel-buscador=""
        >
          <div
            className={`bg-white dark:bg-gray-900 w-full ${ap ? '' : 'rounded-xl shadow-xl '}border border-gray-200 dark:border-gray-700 max-h-[min(80vh,var(--alto-panel,80vh))] flex flex-col`}
            style={ap ? { borderRadius: ap.desplegableRadio, boxShadow: SOMBRA_DESPLEGABLE_CSS[ap.desplegableSombra] } : undefined}
            data-superficie-propia=""
          >
            <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
              {ap ? (
                <CampoConApariencia
                  ap={ap}
                  icono={LupaCampo}
                  inputRef={inputRef}
                  valor={query}
                  onCambiar={setQuery}
                  onTecla={(tecla) => {
                    if (tecla === 'Enter') handleSearchSubmit(query)
                    if (tecla === 'Escape') cerrar()
                  }}
                />
              ) : (<>
              <LupaCampo className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-[#6B7280] outline-none text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchSubmit(query)
                  if (e.key === 'Escape') cerrar()
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-[var(--header-hover)]">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
              </>)}
            </div>
            {renderContent()}
          </div>
      </PanelFlotanteEncabezado>

      {/* Pantalla completa vía portal (evita el stacking context del header). */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div ref={mobilePortalRef} data-superficie-propia="" className={`${pantallaCompleta ? '' : 'md:hidden '}fixed inset-0 z-[9999] bg-white dark:bg-gray-900 flex flex-col`}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            {ap ? (
              <CampoConApariencia
                ap={ap}
                icono={LupaCampo}
                valor={query}
                onCambiar={setQuery}
                autoFocus
                onTecla={(tecla) => {
                  if (tecla === 'Enter') handleSearchSubmit(query)
                  if (tecla === 'Escape') cerrar()
                }}
              />
            ) : (<>
            <LupaCampo className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-[#6B7280] outline-none text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit(query)
                if (e.key === 'Escape') cerrar()
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-[var(--header-hover)]">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
            </>)}
            <button
              onClick={() => { cerrar(); setQuery('') }}
              className="text-sm font-medium ml-1 flex-shrink-0"
              style={{ color: primaryColor }}
            >
              Cerrar
            </button>
          </div>
          {renderContent()}
        </div>,
        document.body
      )}
    </div>
  )
}

/**
 * Campo que abre la lupa con la apariencia del buscador: la misma caja, estados y anillo de foco
 * que la barra (variables `--bq-*`), con la lupa del sitio y el botón para limpiar.
 */
function CampoConApariencia({
  ap,
  icono: Icono,
  inputRef,
  valor,
  onCambiar,
  onTecla,
  autoFocus = false,
}: {
  ap: AparienciaResuelta
  icono: ComponentType<{ className?: string; style?: CSSProperties; 'aria-hidden'?: boolean | 'true' }>
  inputRef?: RefObject<HTMLInputElement>
  valor: string
  onCambiar: (v: string) => void
  onTecla: (tecla: string) => void
  autoFocus?: boolean
}) {
  const ayuda = ap.ayuda ?? 'Buscar productos...'
  return (
    <div
      className={`relative flex min-w-0 flex-1 items-center ${CLASES_CAJA_APARIENCIA}`}
      style={{ ...variablesApariencia(ap), ...estiloCajaApariencia(ap) } as CSSProperties}
      data-apariencia=""
    >
      {ap.iconoLado !== 'none' && !(ap.iconoLado === 'right' && valor) && (
        <Icono
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${ap.iconoLado === 'right' ? 'right-3' : 'left-3'}`}
          style={{ width: ap.iconoTamano, height: ap.iconoTamano, color: 'var(--bq-icono)' }}
        />
      )}
      <input
        ref={inputRef}
        type="text"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={ayuda}
        aria-label={ayuda}
        autoFocus={autoFocus}
        className={`h-full w-full text-base ${CLASES_CAMPO_APARIENCIA}`}
        style={{ ...rellenoCampo(ap), ...(valor ? { paddingRight: 36 } : {}) }}
        onKeyDown={(e) => onTecla(e.key)}
      />
      {valor && (
        <button type="button" onClick={() => onCambiar('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-black/5" aria-label="Limpiar">
          <X className="h-4 w-4" style={{ color: 'var(--bq-icono)' }} />
        </button>
      )}
    </div>
  )
}
