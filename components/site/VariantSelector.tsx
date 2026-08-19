'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Package, Loader2, ShoppingCart, X, Minus, Plus } from 'lucide-react'
import Image from 'next/image'
import { getAvailableStock } from '@/lib/stock'

interface VariantProduct {
  id: number
  uuid: string
  name: string
  sku?: string
  track_stock?: boolean
  variant_data?: Record<string, string>
  product_prices?: { price: number; compare_price?: number | null }[]
  product_images?: {
    id: number
    storage_path: string | null
    is_primary: boolean
    shared_image_id?: number | null
    shared_images?: { storage_path: string } | null
  }[]
  stock_levels?: { qty_on_hand: number; qty_reserved: number }[]
}

interface VariantSelectorProps {
  parentName: string
  variants: VariantProduct[]
  primaryColor: string
  onSelect: (variant: VariantProduct, quantity?: number) => void
  onBuyNow?: (variant: VariantProduct) => void
  onClose?: () => void
  mode?: 'dialog' | 'inline'
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getVariantImageUrl(variant: VariantProduct): string | null {
  if (!variant.product_images || variant.product_images.length === 0) return null
  const primary = variant.product_images.find(img => img.is_primary) || variant.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

export function VariantSelector({
  parentName,
  variants,
  primaryColor,
  onSelect,
  onBuyNow,
  onClose,
  mode = 'dialog'
}: VariantSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [selectedVariant, setSelectedVariant] = useState<VariantProduct | null>(null)
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)

  // Extraer grupos de atributos de variant_data
  const attributeGroups = useMemo(() => {
    const groups: Record<string, Set<string>> = {}
    variants.forEach(v => {
      if (v.variant_data) {
        Object.entries(v.variant_data).forEach(([key, value]) => {
          if (!groups[key]) groups[key] = new Set()
          groups[key].add(value)
        })
      }
    })
    const result: Record<string, string[]> = {}
    Object.entries(groups).forEach(([key, values]) => {
      result[key] = Array.from(values).sort()
    })
    return result
  }, [variants])

  // Pre-seleccionar primera variante
  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      setSelectedVariant(variants[0])
      setSelectedAttributes(variants[0].variant_data || {})
    }
  }, [variants])

  const findMatchingVariant = (attrs: Record<string, string>) => {
    return variants.find(v => {
      if (!v.variant_data) return false
      return Object.entries(attrs).every(([key, value]) => v.variant_data![key] === value)
    })
  }

  const handleAttributeSelect = (attrName: string, value: string) => {
    const newAttrs = { ...selectedAttributes, [attrName]: value }
    setSelectedAttributes(newAttrs)
    const matching = findMatchingVariant(newAttrs)
    if (matching) setSelectedVariant(matching)
  }

  const handleAddToCart = () => {
    if (!selectedVariant) return
    onSelect(selectedVariant, quantity)
    setAdded(true)
    setTimeout(() => { setAdded(false); setQuantity(1) }, 1500)
  }

  const price = selectedVariant?.product_prices?.[0]?.price
  const variantComparePrice = selectedVariant?.product_prices?.[0]?.compare_price
  const stock = selectedVariant ? getAvailableStock(selectedVariant) : null
  const outOfStock = stock !== null && stock <= 0
  const imageUrl = selectedVariant ? getVariantImageUrl(selectedVariant) : null
  const hasAttributeGroups = Object.keys(attributeGroups).length > 0

  const content = (
    <div className="space-y-4">
      {/* Nombre del producto padre */}
      <div className="text-center pb-3 border-b">
        <h3 className="font-semibold text-lg text-gray-900">{parentName}</h3>
        <p className="text-sm text-gray-500">Selecciona una variante</p>
      </div>

      {/* Selectores de atributos */}
      {hasAttributeGroups ? (
        Object.entries(attributeGroups).map(([attrName, values]) => (
          <div key={attrName} className="space-y-2">
            <label className="text-sm font-medium text-gray-700 capitalize">
              {attrName}:
            </label>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const isSelected = selectedAttributes[attrName] === value
                const testAttrs = { ...selectedAttributes, [attrName]: value }
                const hasMatch = findMatchingVariant(testAttrs)

                return (
                  <button
                    key={value}
                    disabled={!hasMatch && !isSelected}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                      isSelected
                        ? 'text-white border-transparent'
                        : hasMatch
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                    style={isSelected ? { backgroundColor: primaryColor } : {}}
                    onClick={() => handleAttributeSelect(attrName, value)}
                  >
                    {value}
                    {isSelected && <Check className="inline ml-1 h-3 w-3" />}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        // Fallback: lista de variantes si no hay variant_data agrupable
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {variants.map((variant) => {
            const vPrice = variant.product_prices?.[0]?.price
            const isSelected = selectedVariant?.id === variant.id
            return (
              <button
                key={variant.id}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'border-2 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={isSelected ? { borderColor: primaryColor } : {}}
                onClick={() => setSelectedVariant(variant)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{variant.name}</p>
                    {variant.variant_data && Object.keys(variant.variant_data).length > 0 && (
                      <p className="text-xs text-gray-600">
                        {Object.entries(variant.variant_data).map(([k, v]) => (
                          <span key={k} className="mr-2"><span className="capitalize font-semibold">{k}:</span> {v}</span>
                        ))}
                      </p>
                    )}
                    {variant.sku && (
                      <p className="text-xs text-gray-400">SKU: {variant.sku}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {(() => {
                      const vCp = variant.product_prices?.[0]?.compare_price
                      return vCp && Number(vCp) > Number(vPrice) ? (
                        <span className="text-xs text-gray-400 line-through mr-2">${Number(vCp).toLocaleString()}</span>
                      ) : null
                    })()}
                    {vPrice && (
                      <span className="font-bold" style={{ color: primaryColor }}>
                        ${Number(vPrice).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Variante seleccionada — preview */}
      {selectedVariant && (
        <div className="p-4 rounded-lg bg-gray-50 border">
          <div className="flex items-center gap-4">
            {imageUrl && (
              <div className="w-16 h-16 rounded-lg overflow-hidden relative flex-shrink-0">
                <Image
                  src={imageUrl}
                  alt={selectedVariant.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{selectedVariant.name}</p>
              {selectedVariant.variant_data && Object.keys(selectedVariant.variant_data).length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {Object.entries(selectedVariant.variant_data).map(([k, v]) => (
                    <span key={k} className="text-xs text-gray-600">
                      <span className="capitalize font-semibold">{k}:</span> {v}
                    </span>
                  ))}
                </div>
              )}
              {selectedVariant.sku && (
                <p className="text-xs text-gray-400 mt-0.5">SKU: {selectedVariant.sku}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              {price ? (
                <div>
                  {variantComparePrice && Number(variantComparePrice) > Number(price) && (
                    <p className="text-sm text-gray-400 line-through">${Number(variantComparePrice).toLocaleString()}</p>
                  )}
                  <p className="text-xl font-bold" style={{ color: primaryColor }}>
                    ${Number(price).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-500">Sin precio</p>
              )}
              {outOfStock && (
                <p className="text-xs text-red-500 font-medium">Agotado</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selector de cantidad */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Cantidad:</span>
        <div className="flex items-center border rounded-lg">
          <button
            type="button"
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            className="p-2 hover:bg-gray-100 rounded-l-lg transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="px-4 py-2 min-w-[3rem] text-center font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity(q => q + 1)}
            className="p-2 hover:bg-gray-100 rounded-r-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Botón agregar */}
      <Button
        size="lg"
        className={`w-full text-lg py-6 transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''}`}
        style={!added ? { backgroundColor: primaryColor } : {}}
        disabled={!selectedVariant || !price || outOfStock}
        onClick={handleAddToCart}
      >
        {added ? (
          <>
            <Check className="h-5 w-5 mr-2" />
            ¡Agregado al carrito!
          </>
        ) : outOfStock ? (
          'Sin stock'
        ) : (
          <>
            <ShoppingCart className="h-5 w-5 mr-2" />
            Agregar al carrito
          </>
        )}
      </Button>

      {/* Botón comprar ahora */}
      {onBuyNow && (
        <Button
          size="lg"
          variant="outline"
          className="w-full text-lg py-6"
          style={{ borderColor: primaryColor, color: primaryColor }}
          disabled={!selectedVariant || !price || outOfStock}
          onClick={() => selectedVariant && onBuyNow(selectedVariant)}
        >
          Comprar ahora
        </Button>
      )}
    </div>
  )

  if (mode === 'inline') return content

  // Dialog mode
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        )}
        {content}
      </div>
    </div>
  )
}
