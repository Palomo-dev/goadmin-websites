'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ShoppingCart, Check, Heart, Share2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Price } from '@/components/site/CurrencyProvider'
import { getProductPrice, getProductComparePrice, getProductImageUrl, getProductDiscount } from '@/components/sections/products/ProductCard'
import { isOutOfStock } from '@/lib/stock'
import { getReviewStats, getSessionSeed } from '@/lib/review-utils'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { textoPlano } from '@/lib/texto/textoPlano'

interface ProductQuickViewProps {
  product: any
  open: boolean
  onClose: () => void
  primaryColor?: string
  onAddToCart?: (product: any) => void
  isAdded?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (productId: number) => void
  onShare?: (product: any) => void
}

export function ProductQuickView({
  product,
  open,
  onClose,
  primaryColor = '#3B82F6',
  onAddToCart,
  isAdded = false,
  isFavorite = false,
  onToggleFavorite,
  onShare,
}: ProductQuickViewProps) {
  const { ruta } = useRutaSitio()
  const [added, setAdded] = useState(isAdded)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !product) return null

  const price = getProductPrice(product)
  const comparePrice = getProductComparePrice(product)
  const discount = getProductDiscount(product)
  const imageUrl = getProductImageUrl(product)
  const outOfStock = isOutOfStock(product)

  // Rating (mismo sistema que ProductCard)
  const realRatingAvg = Number(product.rating_avg) || 0
  const realRatingCount = product.reviews_count || 0
  let ratingAvg = realRatingAvg
  let ratingCount = realRatingCount
  if (realRatingAvg === 0) {
    const sessionSeed = getSessionSeed(Number(product.id) || 0)
    const stats = getReviewStats(Number(product.id) || 0, sessionSeed)
    ratingAvg = stats.avgRating
    ratingCount = stats.totalReviews
  }

  const handleAddToCart = () => {
    setAdded(true)
    onAddToCart?.(product)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate pr-4">{product.name}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 sm:p-6">
          {/* Imagen */}
          <div className="relative aspect-square sm:aspect-[4/3] md:aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <ShoppingCart className="h-16 w-16" />
              </div>
            )}
            {discount && (
              <span
                className="absolute top-3 left-3 px-2.5 py-1.5 rounded-lg text-sm font-bold text-white shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                -{discount}%
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-4">
            {/* Rating con número de reviews */}
            {ratingAvg > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star <= Math.round(ratingAvg) ? 'fill-current' : ''}`}
                      style={{ color: star <= Math.round(ratingAvg) ? primaryColor : '#d1d5db' }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ratingAvg.toFixed(1)}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({ratingCount} {ratingCount === 1 ? 'reseña' : 'reseñas'})</span>
              </div>
            )}

            {textoPlano(product.description) && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 line-clamp-5">{textoPlano(product.description)}</p>
            )}

            {/* Precio */}
            <div className="flex items-center gap-3 flex-wrap">
              {price != null && (
                <span className="text-2xl sm:text-3xl font-bold" style={{ color: primaryColor }}>
                  <Price value={price} />
                </span>
              )}
              {comparePrice && comparePrice > (price ?? 0) && (
                <span className="text-base sm:text-lg text-gray-400 line-through">
                  <Price value={comparePrice} />
                </span>
              )}
            </div>

            {outOfStock && (
              <span className="text-sm text-red-500 font-medium">Sin stock</span>
            )}

            {/* SKU */}
            {product.sku && (
              <p className="text-sm text-gray-500">SKU: {product.sku}</p>
            )}

            {/* Botones — tamaño mediano */}
            <div className="flex flex-col gap-3 mt-2">
              <Button
                size="lg"
                onClick={handleAddToCart}
                disabled={outOfStock || price === null}
                className="w-full text-sm sm:text-base h-12"
                style={{ backgroundColor: primaryColor, color: '#fff' }}
              >
                {added ? <><Check className="h-5 w-5 mr-2" /> Agregado</> : <><ShoppingCart className="h-5 w-5 mr-2" /> Agregar al carrito</>}
              </Button>

              <div className="flex gap-3">
                {onToggleFavorite && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onToggleFavorite(product.id)}
                    className="flex-1 text-sm sm:text-base h-12"
                    style={isFavorite ? { borderColor: primaryColor, color: primaryColor } : {}}
                  >
                    <Heart className={`h-5 w-5 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                    {isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  </Button>
                )}

                {onShare && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => onShare(product)}
                    className="flex-1 text-sm sm:text-base h-12"
                  >
                    <Share2 className="h-5 w-5 mr-2" /> Compartir
                  </Button>
                )}
              </div>

              <Link href={ruta(`/productos/${product.uuid}`)} className="w-full">
                <Button size="lg" variant="ghost" className="w-full text-sm sm:text-base h-12">
                  Ver detalle completo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
