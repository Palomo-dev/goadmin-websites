'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, TrendingUp, Clock, Package } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface ProductSearchProps {
  primaryColor: string
}

interface SearchResult {
  id: number
  uuid: string
  name: string
  price?: number | null
  comparePrice?: number | null
  imageUrl?: string | null
  category?: string | null
  tag?: string | null
}

// Sugerencias de búsqueda (se muestran cuando no hay query)
const popularSearches = [
  'Ofertas', 'Nuevo', 'Tenis', 'Accesorios'
]

export function ProductSearch({ primaryColor }: ProductSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Cargar búsquedas recientes del localStorage
    try {
      const recent = JSON.parse(localStorage.getItem('recent_searches') || '[]')
      setRecentSearches(recent.slice(0, 5))
    } catch {}
  }, [isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    // Cerrar al hacer click fuera
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.products || [])
        }
      } catch {
        setResults([])
      }
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const saveRecentSearch = (term: string) => {
    try {
      const recent = JSON.parse(localStorage.getItem('recent_searches') || '[]')
      const updated = [term, ...recent.filter((s: string) => s !== term)].slice(0, 5)
      localStorage.setItem('recent_searches', JSON.stringify(updated))
    } catch {}
  }

  const handleResultClick = (product: SearchResult) => {
    saveRecentSearch(product.name)
    setIsOpen(false)
    setQuery('')
  }

  const handleSearchSubmit = (term: string) => {
    if (term.trim()) {
      saveRecentSearch(term.trim())
      setQuery(term)
    }
  }

  const renderContent = () => (
    <div className="flex-1 overflow-y-auto p-4">
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300" style={{ borderTopColor: primaryColor }} />
        </div>
      )}

      {!loading && query && results.length > 0 && (
        <div className="space-y-1">
          {results.map((product) => (
            <Link
              key={product.id}
              href={`/productos/${product.uuid}`}
              onClick={() => handleResultClick(product)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden relative flex-shrink-0">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="48px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-5 w-5 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {product.price && (
                    <span className="text-sm font-bold" style={{ color: primaryColor }}>
                      ${Number(product.price).toLocaleString()}
                    </span>
                  )}
                  {product.comparePrice && product.price && Number(product.comparePrice) > Number(product.price) && (
                    <span className="text-xs text-gray-400 line-through">
                      ${Number(product.comparePrice).toLocaleString()}
                    </span>
                  )}
                </div>
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

      {!loading && query && results.length === 0 && (
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
          <div>
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
        </div>
      )}
    </div>
  )

  return (
    <div ref={containerRef} className="relative">
      {/* Botón de búsqueda */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Buscar productos"
      >
        <Search className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      </button>

      {/* Desktop: dropdown */}
      {isOpen && (
        <div className="hidden md:block absolute right-0 top-full mt-2 z-[60]">
          <div className="bg-white dark:bg-gray-900 w-96 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-h-[80vh] flex flex-col">
            <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-800">
              <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchSubmit(query)
                  if (e.key === 'Escape') setIsOpen(false)
                }}
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-gray-100">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
            {renderContent()}
          </div>
        </div>
      )}

      {/* Mobile: fullscreen via portal (evita stacking context del header) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="md:hidden fixed inset-0 z-[9999] bg-white dark:bg-gray-900 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit(query)
                if (e.key === 'Escape') setIsOpen(false)
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
            <button
              onClick={() => { setIsOpen(false); setQuery('') }}
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
