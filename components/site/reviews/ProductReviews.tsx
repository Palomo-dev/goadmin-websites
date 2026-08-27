'use client'

/**
 * FASE 10.2 — Orquestador de reseñas.
 *
 * Elige el provider según `reviews_source` de la configuración del editor:
 * - `generated` (default): usa generatedReviews → cero cambio visual.
 * - `real`: usa realReviews (product_reviews aprobadas).
 * - `mixed`: reales primero, completa con generadas hasta min_visible.
 * - `auto`: generadas hasta acumular auto_switch_threshold reales.
 *
 * La UI es idéntica en todos los modos: el orquestador alimenta los mismos
 * componentes (ReviewList, ReviewForm, RatingDistribution).
 */

import { useState, useMemo, useEffect } from 'react'
import { Filter, Send, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReviewItem, ReviewsResult, ReviewsConfig } from './types'
import { resolveReviewsConfig } from './types'
import { getGeneratedReviews, getSessionSeed } from './providers/generatedReviews'
import { getRealReviews } from './providers/realReviews'
import { getMixedReviews, getAutoReviews } from './providers/mixedReviews'
import { ReviewList } from './ReviewList'
import { ReviewForm } from './ReviewForm'
import { RatingDistribution } from './RatingDistribution'

interface ProductReviewsProps {
  productId: number
  productName: string
  primaryColor: string
  /** Config de reseñas desde el editor (opcional — default = generated). */
  reviewsConfig?: Partial<ReviewsConfig> | null
  /** Agregados del producto (rating_avg, reviews_count) para modo real/auto. */
  productStats?: { rating_avg?: number | null; reviews_count?: number | null } | null
}

export function ProductReviews({
  productId,
  productName,
  primaryColor,
  reviewsConfig,
  productStats,
}: ProductReviewsProps) {
  const config = resolveReviewsConfig(reviewsConfig)

  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'recent' | 'helpful'>('recent')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [realResult, setRealResult] = useState<ReviewsResult | null>(null)
  const ITEMS_PER_PAGE = 10

  // --- Provider generated (síncrono, como el original) ---
  const sessionSeed = useMemo(() => getSessionSeed(productId), [productId])
  const generatedResult = useMemo(
    () => getGeneratedReviews(productId, sessionSeed, config),
    [productId, sessionSeed, config],
  )

  // --- Provider real/mixed/auto ( asíncrono, se carga en efecto) ---
  useEffect(() => {
    if (config.reviews_source === 'generated') {
      setRealResult(null)
      return
    }
    let cancelled = false
    async function load() {
      let result: ReviewsResult
      if (config.reviews_source === 'real') {
        result = await getRealReviews(productId, 50)
      } else if (config.reviews_source === 'mixed') {
        result = await getMixedReviews(productId, config)
      } else {
        // auto
        result = await getAutoReviews(productId, config, productStats ?? undefined)
      }
      if (!cancelled) setRealResult(result)
    }
    load()
    return () => { cancelled = true }
  }, [productId, config, productStats])

  // --- Decidir qué resultado usar ---
  const activeResult: ReviewsResult = useMemo(() => {
    if (config.reviews_source === 'generated') return generatedResult
    if (realResult) return realResult
    // Mientras cargan las reales, mostrar generadas como placeholder
    return generatedResult
  }, [config.reviews_source, generatedResult, realResult])

  const allReviews = activeResult.reviews
  const totalReviews = activeResult.totalReviews
  const avgRating = activeResult.avgRating.toFixed(1)

  // Stats
  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: allReviews.filter(rev => rev.rating === r).length,
    percentage: totalReviews > 0 ? Math.round((allReviews.filter(rev => rev.rating === r).length / totalReviews) * 100) : 0,
  }))

  // Filter & sort
  const filtered = useMemo(() => {
    let result = [...allReviews]
    if (filterRating !== null) {
      result = result.filter(r => r.rating === filterRating)
    }
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } else {
      result.sort((a, b) => b.likes - a.likes)
    }
    return result
  }, [allReviews, filterRating, sortBy])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedReviews = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const renderStars = (rating: number, size: string = 'h-4 w-4') => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${size} ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  )

  // --- Estado vacío en modo real sin reseñas ---
  if (config.reviews_source === 'real' && realResult && realResult.totalReviews === 0) {
    return (
      <div className="mt-16 border-t pt-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Opiniones de clientes</h2>
            <p className="text-gray-500 mt-1">Aún no hay opiniones para este producto</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            style={{ backgroundColor: primaryColor }}
            className="text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            Escribir una opinión
          </Button>
        </div>
        {showForm && <ReviewForm primaryColor={primaryColor} />}
        {!showForm && (
          <div className="p-8 text-center bg-gray-50 rounded-xl">
            <p className="text-gray-500">Sé el primero en compartir tu experiencia con este producto.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-16 border-t pt-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Opiniones de clientes</h2>
          <p className="text-gray-500 mt-1">
            Más de <span className="font-semibold text-gray-700">{totalReviews.toLocaleString('es-CO')}</span> opiniones verificadas
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          style={{ backgroundColor: primaryColor }}
          className="text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          Escribir una opinión
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 p-6 bg-gray-50 rounded-xl">
        {/* Average rating */}
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-5xl font-bold text-gray-900">{avgRating}</span>
          <div className="mt-2">{renderStars(Math.round(Number(avgRating)), 'h-5 w-5')}</div>
          <p className="text-sm text-gray-500 mt-1">Basado en {totalReviews.toLocaleString('es-CO')} opiniones</p>
        </div>

        {/* Rating bars */}
        <RatingDistribution
          ratingCounts={ratingCounts}
          totalReviews={totalReviews}
          filterRating={filterRating}
          onFilterChange={(r) => { setFilterRating(r); setPage(1) }}
          primaryColor={primaryColor}
        />
      </div>

      {/* Form */}
      {showForm && <ReviewForm primaryColor={primaryColor} />}

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filtrar:</span>
        </div>
        <button
          onClick={() => { setFilterRating(null); setPage(1) }}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            filterRating === null ? 'border-transparent text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
          style={filterRating === null ? { backgroundColor: primaryColor } : {}}
        >
          Todas ({totalReviews.toLocaleString('es-CO')})
        </button>
        {[5, 4, 3, 2, 1].map(r => (
          <button
            key={r}
            onClick={() => { setFilterRating(filterRating === r ? null : r); setPage(1) }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              filterRating === r ? 'border-transparent text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
            style={filterRating === r ? { backgroundColor: primaryColor } : {}}
          >
            {r} ★
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="recent">Más recientes</option>
            <option value="helpful">Más útiles</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-4">
        Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length.toLocaleString('es-CO')} opiniones
      </p>

      {/* Reviews list */}
      <ReviewList
        reviews={paginatedReviews}
        primaryColor={primaryColor}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Disclaimer opcional para reseñas generadas */}
      {config.show_generated_disclaimer && !activeResult.isReal && (
        <p className="mt-6 text-xs text-gray-400 text-center">
          Las opiniones mostradas son ejemplos generados y no corresponden a clientes reales.
        </p>
      )}
    </div>
  )
}

