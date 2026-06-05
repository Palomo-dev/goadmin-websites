'use client'

import { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, Check, X, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VariantData {
  id: number
  name: string
  variant_data?: Record<string, string>
  product_prices?: { price: number; compare_price?: number | null }[]
  product_images?: { storage_path: string | null; is_primary: boolean; shared_images?: { storage_path: string } | null }[]
}

interface StickyAddToCartProps {
  productId: number
  productName: string
  price: number
  comparePrice?: number | null
  imageUrl?: string | null
  primaryColor: string
  isParent?: boolean
  variants?: VariantData[]
  organizationSubdomain?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getCartKey(orgSubdomain?: string): string {
  const subdomain = orgSubdomain || window.location.hostname.split('.')[0]
  return `cart_${subdomain}`
}

function getVariantImg(variant: VariantData): string | null {
  if (!variant.product_images || variant.product_images.length === 0) return null
  const primary = variant.product_images.find(img => img.is_primary) || variant.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

export function StickyAddToCart({
  productId,
  productName,
  price,
  comparePrice,
  imageUrl,
  primaryColor,
  isParent = false,
  variants = [],
  organizationSubdomain
}: StickyAddToCartProps) {
  const [added, setAdded] = useState(false)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [selectedVariant, setSelectedVariant] = useState<VariantData | null>(null)

  // Extraer grupos de atributos
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

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  const getActivePrice = () => {
    if (isParent && selectedVariant) {
      return Number(selectedVariant.product_prices?.[0]?.price || price)
    }
    return price
  }

  const getActiveComparePrice = () => {
    if (isParent && selectedVariant) {
      return selectedVariant.product_prices?.[0]?.compare_price ? Number(selectedVariant.product_prices[0].compare_price) : null
    }
    return comparePrice
  }

  const handleAddToCart = () => {
    try {
      const cartKey = getCartKey(organizationSubdomain)
      const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
      const activePrice = getActivePrice()
      const activeCp = getActiveComparePrice()

      if (isParent && selectedVariant) {
        const variantImgUrl = getVariantImg(selectedVariant) || imageUrl
        const idx = cart.findIndex((c: any) => c.id === selectedVariant.id)
        if (idx >= 0) {
          cart[idx].quantity += 1
        } else {
          cart.push({
            id: selectedVariant.id,
            name: selectedVariant.name,
            price: activePrice,
            quantity: 1,
            ...(variantImgUrl && { imageUrl: variantImgUrl }),
            ...(activeCp && { comparePrice: activeCp }),
            ...(selectedVariant.variant_data && { variantAttributes: selectedVariant.variant_data })
          })
        }
      } else {
        const idx = cart.findIndex((c: any) => c.id === productId)
        if (idx >= 0) {
          cart[idx].quantity += 1
        } else {
          cart.push({
            id: productId,
            name: productName,
            price: activePrice,
            quantity: 1,
            ...(imageUrl && { imageUrl }),
            ...(activeCp && { comparePrice: activeCp })
          })
        }
      }

      localStorage.setItem(cartKey, JSON.stringify(cart))
      window.dispatchEvent(new CustomEvent('cart-updated'))
      setAdded(true)
      setExpanded(false)
      setTimeout(() => setAdded(false), 2000)
    } catch (e) {}
  }

  const activePrice = getActivePrice()
  const activeCp = getActiveComparePrice()
  const hasVariants = isParent && variants.length > 0

  return (
    <>
      {/* Overlay cuando está expandido */}
      {expanded && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setExpanded(false)} />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 lg:hidden ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Panel expandido de variantes */}
        {expanded && hasVariants && (
          <div className="px-4 pt-4 pb-2 border-b max-h-[50vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-gray-700">Selecciona opciones</p>
              <button onClick={() => setExpanded(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            {Object.entries(attributeGroups).map(([attrName, values]) => (
              <div key={attrName} className="mb-3">
                <label className="text-xs font-medium text-gray-600 capitalize mb-1 block">{attrName}:</label>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const isSelected = selectedAttributes[attrName] === value
                    return (
                      <button
                        key={value}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'text-white border-transparent'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                        style={isSelected ? { backgroundColor: primaryColor } : {}}
                        onClick={() => handleAttributeSelect(attrName, value)}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Barra principal */}
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {activeCp && activeCp > activePrice && (
                  <span className="text-xs text-gray-400 line-through">${activeCp.toLocaleString()}</span>
                )}
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  ${activePrice.toLocaleString()}
                </span>
              </div>
              {hasVariants && selectedVariant?.variant_data && (
                <p className="text-xs text-gray-500 truncate">
                  {Object.entries(selectedVariant.variant_data).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                </p>
              )}
            </div>

            {hasVariants && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="p-2 rounded-full border border-gray-300 hover:bg-gray-50"
              >
                <ChevronUp className="h-4 w-4 text-gray-600" />
              </button>
            )}

            <Button
              onClick={handleAddToCart}
              className={`px-6 py-2 transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''}`}
              style={!added ? { backgroundColor: primaryColor } : {}}
            >
              {added ? (
                <><Check className="h-4 w-4 mr-1" /> Agregado</>
              ) : (
                <><ShoppingCart className="h-4 w-4 mr-1" /> Agregar al carrito</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
