'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AddToCartButton } from '@/components/site/AddToCartButton'
import { VariantSelector } from '@/components/site/VariantSelector'
import { ProductModifierSelector, type ProductModifierSelectorRef, type SelectedModifier, type ModifierGroup } from '@/components/site/ProductModifierSelector'
import { Zap, Minus, Plus } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getVariantImageUrl(variant: any): string | null {
  if (!variant.product_images || variant.product_images.length === 0) return null
  const primary = variant.product_images.find((img: any) => img.is_primary) || variant.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

function getCartKey(orgSubdomain?: string): string {
  const subdomain = orgSubdomain || window.location.hostname.split('.')[0]
  return `cart_${subdomain}`
}

function addItemToCart(item: { id: number; name: string; price: number; imageUrl?: string; comparePrice?: number; variantAttributes?: Record<string, string> }, orgSubdomain?: string) {
  const cartKey = getCartKey(orgSubdomain)
  const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
  const idx = cart.findIndex((c: any) => c.id === item.id)
  if (idx >= 0) {
    cart[idx].quantity += 1
  } else {
    cart.push({ ...item, quantity: 1 })
  }
  localStorage.setItem(cartKey, JSON.stringify(cart))
  window.dispatchEvent(new CustomEvent('cart-updated'))
}

interface ProductDetailActionsProps {
  product: any
  variants: any[]
  price: number
  comparePrice?: number | null
  imageUrl: string | null
  primaryColor: string
  isParent: boolean
  organizationSubdomain?: string
  modifierGroups?: ModifierGroup[]
  trackStock?: boolean
  stockLevels?: { qty_on_hand: number; qty_reserved: number }[]
}

function getAvailableStock(trackStock: boolean | undefined, stockLevels: { qty_on_hand: number; qty_reserved: number }[] | undefined): number | null {
  if (trackStock === false) return null
  if (!stockLevels || stockLevels.length === 0) return null
  return stockLevels.reduce((sum, sl) => sum + (Number(sl.qty_on_hand) - Number(sl.qty_reserved)), 0)
}

export function ProductDetailActions({
  product,
  variants,
  price,
  comparePrice,
  imageUrl,
  primaryColor,
  isParent,
  organizationSubdomain,
  modifierGroups = [],
  trackStock,
  stockLevels
}: ProductDetailActionsProps) {
  const router = useRouter()
  const modifierRef = useRef<ProductModifierSelectorRef>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([])
  const [quantity, setQuantity] = useState(1)

  const modifiersExtraTotal = selectedModifiers.reduce((sum, m) => sum + (m.extraPrice || 0), 0)
  const effectivePrice = price + modifiersExtraTotal

  const stock = getAvailableStock(trackStock, stockLevels)
  const outOfStock = stock !== null && stock <= 0

  const handleVariantSelect = (variant: any, qty: number = 1) => {
    const variantPrice = variant.product_prices?.[0]?.price || 0
    const variantComparePrice = variant.product_prices?.[0]?.compare_price
    const variantImgUrl = getVariantImageUrl(variant) || imageUrl
    const cartKey = getCartKey(organizationSubdomain)
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const idx = cart.findIndex((c: any) => c.id === variant.id)
    if (idx >= 0) {
      cart[idx].quantity += qty
    } else {
      cart.push({
        id: variant.id,
        name: variant.name,
        price: Number(variantPrice),
        quantity: qty,
        ...(variantImgUrl && { imageUrl: variantImgUrl }),
        ...(variantComparePrice && { comparePrice: Number(variantComparePrice) }),
        ...(variant.variant_data && { variantAttributes: variant.variant_data })
      })
    }
    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }

  const handleBuyNowVariant = (variant: any) => {
    const variantPrice = variant.product_prices?.[0]?.price || 0
    const variantComparePrice = variant.product_prices?.[0]?.compare_price
    const variantImgUrl = getVariantImageUrl(variant) || imageUrl
    // Limpiar carrito y agregar solo este producto
    const cartKey = getCartKey(organizationSubdomain)
    const item = {
      id: variant.id,
      name: variant.name,
      price: Number(variantPrice),
      quantity: 1,
      ...(variantImgUrl && { imageUrl: variantImgUrl }),
      ...(variantComparePrice && { comparePrice: Number(variantComparePrice) }),
      ...(variant.variant_data && { variantAttributes: variant.variant_data })
    }
    localStorage.setItem(cartKey, JSON.stringify([item]))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    router.push('/checkout')
  }

  const handleBuyNowSimple = () => {
    if (modifierGroups.length > 0 && modifierRef.current) {
      if (!modifierRef.current.validate()) return
    }
    const cartKey = getCartKey(organizationSubdomain)
    const modKey = selectedModifiers.map(m => m.modifierId).sort().join('-')
    const cartItemId = modKey ? `${product.id}_${modKey}` : product.id
    const item = {
      id: cartItemId,
      productId: product.id,
      name: product.name,
      price: Number(effectivePrice),
      quantity: 1,
      ...(imageUrl && { imageUrl }),
      ...(comparePrice && { comparePrice: Number(comparePrice) }),
      ...(selectedModifiers.length > 0 && { modifiers: selectedModifiers })
    }
    localStorage.setItem(cartKey, JSON.stringify([item]))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    router.push('/checkout')
  }

  const handleAddWithQuantity = () => {
    if (modifierGroups.length > 0 && modifierRef.current) {
      if (!modifierRef.current.validate()) return
    }
    const cartKey = getCartKey(organizationSubdomain)
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const modKey = selectedModifiers.map(m => m.modifierId).sort().join('-')
    const cartItemId = modKey ? `${product.id}_${modKey}` : product.id
    const idx = cart.findIndex((c: any) => c.id === cartItemId)
    if (idx >= 0) {
      cart[idx].quantity += quantity
    } else {
      cart.push({
        id: cartItemId,
        productId: product.id,
        name: product.name,
        price: Number(effectivePrice),
        quantity,
        ...(imageUrl && { imageUrl }),
        ...(comparePrice && { comparePrice: Number(comparePrice) }),
        ...(selectedModifiers.length > 0 && { modifiers: selectedModifiers })
      })
    }
    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }

  if (isParent && variants.length > 0) {
    return (
      <div className="space-y-3 pt-4">
        <VariantSelector
          parentName={product.name}
          variants={variants}
          primaryColor={primaryColor}
          mode="inline"
          onSelect={handleVariantSelect}
          onBuyNow={handleBuyNowVariant}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-4">
      {/* Selector de modificadores (nuevo sistema ERP) */}
      {modifierGroups.length > 0 && (
        <ProductModifierSelector
          ref={modifierRef}
          groups={modifierGroups}
          primaryColor={primaryColor}
          onChange={setSelectedModifiers}
        />
      )}

      {/* Badge Agotado */}
      {outOfStock && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">Producto agotado</span>
        </div>
      )}

      {/* Selector de cantidad */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Cantidad:</span>
        <div className={`flex items-center border rounded-lg ${outOfStock ? 'opacity-50 pointer-events-none' : ''}`}>
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

      {/* Precio con extras */}
      {modifiersExtraTotal > 0 && (
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold" style={{ color: primaryColor }}>
            ${effectivePrice.toLocaleString()}
          </span>
          <span className="text-sm text-gray-400 line-through">${price.toLocaleString()}</span>
          <span className="text-xs text-gray-500">+${modifiersExtraTotal.toLocaleString()} en extras</span>
        </div>
      )}

      <AddToCartButton
        productId={product.id}
        productName={product.name}
        price={effectivePrice}
        imageUrl={imageUrl}
        primaryColor={primaryColor}
        variant="full"
        quantity={quantity}
        organizationSubdomain={organizationSubdomain}
        onClick={handleAddWithQuantity}
        disabled={outOfStock}
      />

      <Button
        size="lg"
        variant="outline"
        className="w-full"
        style={{ borderColor: primaryColor, color: primaryColor }}
        onClick={handleBuyNowSimple}
        disabled={outOfStock}
      >
        {outOfStock ? 'Sin stock' : (<><Zap className="h-5 w-5 mr-2" />Comprar ahora</>)}
      </Button>
    </div>
  )
}
