'use client';

import { useState, useEffect, useId, useRef } from 'react';
import { useBusquedasRecientes, useCerrarBuscador, usePosicionPanel, useResultadosBusqueda, type ResultadoBusqueda } from './buscador/comportamiento';
import { Search, X, TrendingUp, Clock, Package } from 'lucide-react';
import Link from '@/components/site/Enlace'
import Image from 'next/image';
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext';
import { urlResultadosBusqueda } from '@/lib/products/urlBusqueda';
import { useEncabezadoPie } from './EncabezadoPieContext';
import { SOMBRA_DESPLEGABLE_CSS, rellenoCampo, type AparienciaResuelta } from '@/lib/website/v2/aparienciaBuscador';
import { CLASES_CAMPO_APARIENCIA } from './buscador/clasesApariencia';
import { PanelFlotanteEncabezado } from './header/PanelFlotanteEncabezado';

interface SearchBarInputProps {
  primaryColor: string;
  className?: string;
  placeholder?: string;
  /** Tamaño del input: 'sm' (móvil), 'md' (desktop normal), 'lg' (marketplace grande) */
  size?: 'sm' | 'md' | 'lg';
  /** Icono de búsqueda personalizable (Fase 12B) */
  icon?: any;
  /**
   * Cromo opcional (borde, esquinas, lado del ícono). Ausente: el input de siempre.
   */
  cromo?: {
    radius?: 'square' | 'rounded' | 'semi' | 'pill' | 'circle'
    border?: 'none' | 'thin' | 'thick'
    borderColor?: string
    background?: string
    iconSide?: 'left' | 'right'
    iconColor?: string
    iconBackground?: string
    /** Sin lupa dentro del campo (el buscador ya trae botón de buscar); el texto queda con px-4. */
    sinIcono?: boolean
    /**
     * Dentro de la barra unificada de BuscadorCromo: el borde, el fondo, las esquinas y el foco los
     * pone la barra; el campo va sin borde y transparente.
     */
    enBarra?: boolean
  }
  /**
   * Nombre de categoría elegido en el desplegable del buscador compacto del celular: las
   * sugerencias se limitan a esa categoría. Ausente: todas (lo de siempre).
   */
  filtroCategoria?: string
  /**
   * Slug de la categoría elegida: las sugerencias las filtra el servidor (con subcategorías) y
   * Enter abre /search con esa categoría. Ausente: lo de siempre.
   */
  categoriaSlug?: string
  /** Avisa el texto escrito (el botón «Buscar» del buscador compacto lo usa). */
  onQueryChange?: (q: string) => void
  /** Texto que trae la URL de /search: se muestra en el campo al llegar. Ausente: vacío. */
  valorInicial?: string
  /**
   * Apariencia del buscador ya resuelta (search_appearance, Figma 3241:99000), solo dentro de la
   * barra con apariencia de BuscadorCromo (`cromo.enBarra`): texto, ayuda, lupa y desplegable. La
   * caja (borde, fondo, foco) la pinta la barra con las variables `--bq-*`. Ausente: lo de hoy.
   */
  apariencia?: AparienciaResuelta
}

type SearchResult = ResultadoBusqueda;

const sizeConfig = {
  sm: {
    input: 'h-10 text-sm',
    icon: 'h-4 w-4',
    padding: 'pl-9 pr-3',
  },
  md: {
    input: 'h-11 text-sm',
    icon: 'h-5 w-5',
    padding: 'pl-10 pr-4',
  },
  lg: {
    input: 'h-12 text-base',
    icon: 'h-5 w-5',
    padding: 'pl-11 pr-4',
  },
};

export function SearchBarInput({
  primaryColor,
  className = '',
  placeholder = 'Buscar productos...',
  size = 'md',
  icon: SearchIconComp = Search,
  cromo,
  filtroCategoria,
  categoriaSlug,
  onQueryChange,
  valorInicial,
  apariencia,
}: SearchBarInputProps) {
  const panelId = useId();
  const ap = cromo?.enBarra ? apariencia : undefined;
  const ayuda = ap?.ayuda ?? placeholder;
  const { ruta } = useRutaSitio();
  // Populares: las de la tienda (search_popular) o sus primeras categorías del menú; nunca genéricas.
  const { busquedasPopulares: popularSearches } = useEncabezadoPie();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // El desplegable se pinta fuera del <header> (PanelFlotanteEncabezado): el clic adentro no cierra.
  const panelRef = useRef<HTMLDivElement>(null);
  const cfg = sizeConfig[size];
  // Al llegar a /search el campo muestra lo buscado (solo cuando cambia el valor de la URL).
  useEffect(() => {
    if (valorInicial) setQuery(valorInicial);
  }, [valorInicial]);
  // Comportamiento común con el panel de la lupa (components/site/buscador/comportamiento.ts):
  // resultados desde 2 caracteres, recientes, cierre por clic afuera y Escape, y posición propia.
  const { resultados: results, cargando: loading, sugiere } = useResultadosBusqueda(query, categoriaSlug);
  const { recientes: recentSearches, guardar: saveRecentSearch } = useBusquedasRecientes(focused);
  useCerrarBuscador(focused, () => setFocused(false), [containerRef, panelRef]);
  const abiertoPanel = focused && (!query || sugiere);
  // El desplegable tiene ancho propio (mín. 360px, dentro de la pantalla): nunca el del input.
  const posicion = usePosicionPanel(abiertoPanel, containerRef);
  const visibles = filtroCategoria && !categoriaSlug ? results.filter((r) => r.category === filtroCategoria) : results;

  const handleResultClick = (product: SearchResult) => {
    saveRecentSearch(product.name);
    setQuery('');
    setFocused(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} data-superficie-propia="">
      {/* Input visible tipo marketplace */}
      <div className={ap ? 'relative h-full' : 'relative'}>
        {ap ? (
          ap.iconoLado !== 'none' && !(ap.iconoLado === 'right' && query) && (
            <SearchIconComp
              aria-hidden="true"
              className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${ap.iconoLado === 'right' ? 'right-3' : 'left-3'}`}
              style={{ width: ap.iconoTamano, height: ap.iconoTamano, color: 'var(--bq-icono)' }}
            />
          )
        ) : !cromo?.sinIcono && <SearchIconComp
          className={cromo
            ? `absolute top-1/2 -translate-y-1/2 ${cfg.icon} pointer-events-none ${cromo.iconSide === 'right' ? 'right-3' : 'left-3'} ${cromo.iconColor ? '' : 'text-gray-400'}`
            : `absolute left-3 top-1/2 -translate-y-1/2 ${cfg.icon} text-gray-400 pointer-events-none`}
          style={cromo?.iconColor || cromo?.iconBackground ? { color: cromo.iconColor, backgroundColor: cromo.iconBackground, borderRadius: 999 } : undefined}
        />}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onQueryChange?.(e.target.value); }}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              saveRecentSearch(query.trim());
              window.location.href = ruta(urlResultadosBusqueda(query.trim(), categoriaSlug));
            }
            if (e.key === 'Escape') {
              setFocused(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={ayuda}
          aria-label={ayuda}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="dialog"
          aria-expanded={abiertoPanel}
          aria-controls={abiertoPanel ? panelId : undefined}
          className={ap
            ? `h-full w-full ${CLASES_CAMPO_APARIENCIA} ${ap.alto >= 48 ? 'text-base' : 'text-sm'}`
            : cromo?.enBarra
            ? `w-full ${cfg.input} ${cromo.sinIcono ? 'px-3' : cromo.iconSide === 'right' ? 'pl-3 pr-10' : cfg.padding} border-0 bg-transparent outline-none text-gray-900 placeholder:text-[#6B7280]`
            : cromo
            ? `w-full ${cfg.input} ${cromo.sinIcono ? 'px-4' : cromo.iconSide === 'right' ? 'pl-3 pr-10' : cfg.padding} ${cromo.background ? '' : 'bg-gray-50 dark:bg-gray-800'} ${cromo.border === 'none' ? 'border-0' : cromo.border === 'thick' ? 'border-2' : 'border border-gray-200 dark:border-gray-700'} ${cromo.radius === 'square' ? 'rounded-none' : cromo.radius === 'rounded' ? 'rounded-md' : cromo.radius === 'semi' ? 'rounded-lg' : 'rounded-full'} outline-none transition-all text-gray-900 dark:text-white placeholder:text-[#6B7280] focus:bg-white dark:focus:bg-gray-900 focus:border-2`
            : `w-full ${cfg.input} ${cfg.padding} bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full outline-none transition-all text-gray-900 dark:text-white placeholder:text-[#6B7280] focus:bg-white dark:focus:bg-gray-900 focus:border-2`}
          style={ap ? { ...rellenoCampo(ap), ...(query ? { paddingRight: 36 } : {}) } : cromo?.enBarra ? undefined : { ['--tw-border-color' as string]: primaryColor, ...(cromo?.background ? { backgroundColor: cromo.background } : {}), ...(cromo?.borderColor ? { borderColor: cromo.borderColor } : {}) }}
          onFocusCapture={(e) => {
            if (cromo?.enBarra) return;
            (e.target as HTMLInputElement).style.borderColor = primaryColor;
          }}
          onBlurCapture={(e) => {
            (e.target as HTMLInputElement).style.borderColor = '';
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Limpiar"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Dropdown de resultados. En la cabecera va en su capa, fuera del <header> (recorte de la
          fila del celular, transform de «Al bajar», z-index de la cabecera): ver
          PanelFlotanteEncabezado. Fuera de una cabecera, donde siempre. */}
      <PanelFlotanteEncabezado
        abierto={abiertoPanel}
        ancla={containerRef}
        posicion={posicion}
        refPanel={panelRef}
        enLinea={{
          className: `absolute top-full mt-2 z-[100]${posicion ? '' : ' left-0 right-0'}`,
          style: posicion ? { left: posicion.left, width: posicion.width } : undefined,
        }}
          data-panel-buscador=""
          id={panelId}
          role="dialog"
          aria-label="Sugerencias de búsqueda"
        >
          <div
            className={`bg-white dark:bg-gray-900 ${ap ? '' : 'rounded-xl shadow-2xl '}border border-gray-200 dark:border-gray-700 max-h-[min(70vh,var(--alto-panel,70vh))] flex flex-col overflow-hidden`}
            style={ap ? { borderRadius: ap.desplegableRadio, boxShadow: SOMBRA_DESPLEGABLE_CSS[ap.desplegableSombra] } : undefined}
          >
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div
                  className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300"
                  style={{ borderTopColor: primaryColor }}
                />
              </div>
            )}

            {!loading && sugiere && visibles.length > 0 && (
              <div className="overflow-y-auto p-2 space-y-1">
                {visibles.map((product) => (
                  <Link
                    key={product.id}
                    href={ruta(`/productos/${product.uuid}`)}
                    onClick={() => handleResultClick(product)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {ap?.desplegableImagenes !== false && <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden relative flex-shrink-0">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-gray-300" />
                        </div>
                      )}
                    </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {product.name}
                      </p>
                      {ap?.desplegablePrecios !== false && <div className="flex items-center gap-2 mt-0.5">
                        {product.price && (
                          <span className="text-sm font-bold" style={{ color: primaryColor }}>
                            ${Number(product.price).toLocaleString('es-CO')}
                          </span>
                        )}
                        {product.comparePrice &&
                          product.price &&
                          Number(product.comparePrice) > Number(product.price) && (
                            <span className="text-xs text-gray-400 line-through">
                              ${Number(product.comparePrice).toLocaleString('es-CO')}
                            </span>
                          )}
                      </div>}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!loading && sugiere && visibles.length === 0 && (
              <div className="text-center py-8 px-4">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  No se encontraron productos para &quot;{query}&quot;
                </p>
              </div>
            )}

            {!query && (
              <div className="p-4 space-y-5 overflow-y-auto">
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
                          className="px-3 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
                        className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
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
      </PanelFlotanteEncabezado>
    </div>
  );
}
