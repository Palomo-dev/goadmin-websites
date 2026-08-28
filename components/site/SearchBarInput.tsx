'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Clock, Package } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface SearchBarInputProps {
  primaryColor: string;
  organizationId?: number;
  className?: string;
  placeholder?: string;
  /** Tamaño del input: 'sm' (móvil), 'md' (desktop normal), 'lg' (marketplace grande) */
  size?: 'sm' | 'md' | 'lg';
  /** Icono de búsqueda personalizable (Fase 12B) */
  icon?: any;
}

interface SearchResult {
  id: number;
  uuid: string;
  name: string;
  price?: number | null;
  comparePrice?: number | null;
  imageUrl?: string | null;
  category?: string | null;
  tag?: string | null;
}

const popularSearches = ['Ofertas', 'Nuevo', 'Tenis', 'Accesorios'];

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
  organizationId,
  className = '',
  placeholder = 'Buscar productos...',
  size = 'md',
  icon: SearchIconComp = Search,
}: SearchBarInputProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = sizeConfig[size];

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem('recent_searches') || '[]');
      setRecentSearches(recent.slice(0, 5));
    } catch {}
  }, [focused]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    if (focused) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [focused]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const url = organizationId
          ? `/api/products/search?q=${encodeURIComponent(query)}&organizationId=${organizationId}`
          : `/api/products/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(data.products || []);
        }
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, organizationId]);

  const saveRecentSearch = (term: string) => {
    try {
      const recent = JSON.parse(localStorage.getItem('recent_searches') || '[]');
      const updated = [term, ...recent.filter((s: string) => s !== term)].slice(0, 5);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch {}
  };

  const handleResultClick = (product: SearchResult) => {
    saveRecentSearch(product.name);
    setQuery('');
    setFocused(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input visible tipo marketplace */}
      <div className="relative">
        <SearchIconComp
          className={`absolute left-3 top-1/2 -translate-y-1/2 ${cfg.icon} text-gray-400 pointer-events-none`}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              saveRecentSearch(query.trim());
              window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
            }
            if (e.key === 'Escape') {
              setFocused(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          className={`w-full ${cfg.input} ${cfg.padding} bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:border-2`}
          style={{ ['--tw-border-color' as string]: primaryColor }}
          onFocusCapture={(e) => {
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

      {/* Dropdown de resultados */}
      {focused && (
        <div className="absolute left-0 right-0 top-full mt-2 z-[100]">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[70vh] flex flex-col overflow-hidden">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div
                  className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300"
                  style={{ borderTopColor: primaryColor }}
                />
              </div>
            )}

            {!loading && query && results.length > 0 && (
              <div className="overflow-y-auto p-2 space-y-1">
                {results.map((product) => (
                  <Link
                    key={product.id}
                    href={`/productos/${product.uuid}`}
                    onClick={() => handleResultClick(product)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden relative flex-shrink-0">
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
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
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
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="text-center py-8 px-4">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  No se encontraron productos para &quot;{query}&quot;
                </p>
              </div>
            )}

            {!query && (
              <div className="p-4 space-y-5">
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
                <div>
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
