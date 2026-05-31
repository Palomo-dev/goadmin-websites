'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Package, Loader2, ShoppingCart, X } from 'lucide-react'
import Image from 'next/image'

interface VariantProduct {
  id: number
  uuid: string
  name: string
  sku?: string
  variant_data?: Record<string, string>
  product_prices?: { price: number }[]
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
  onSelect: (variant: VariantProduct) => void
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

function getAvailableStock(variant: VariantProduct): number | null {
  if (!variant.stock_levels || variant.stock_levels.length === 0) return null
  return variant.stock_levels.reduce(
    (sum, sl) => sum + (Number(sl.qty_on_hand) - Number(sl.qty_reserved)), 0
  )
}

export function VariantSelector({
  parentName,
  variants,
  primaryColor,
  onSelect,
  onClose,
  mode = 'dialog'
}: VariantSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [selectedVariant, setSelectedVariant] = useState<VariantProduct | null>(null)
  const [added, setAdded] = useState(false)

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
    onSelect(selectedVariant)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const price = selectedVariant?.product_prices?.[0]?.price
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
                    {variant.sku && (
                      <p className="text-xs text-gray-500">SKU: {variant.sku}</p>
                    )}
                  </div>
                  {vPrice && (
                    <span className="font-bold" style={{ color: primaryColor }}>
                      ${Number(vPrice).toLocaleString()}
                    </span>
                  )}
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
              {selectedVariant.sku && (
                <p className="text-xs text-gray-500">SKU: {selectedVariant.sku}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              {price ? (
                <p className="text-xl font-bold" style={{ color: primaryColor }}>
                  ${Number(price).toLocaleString()}
                </p>
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
