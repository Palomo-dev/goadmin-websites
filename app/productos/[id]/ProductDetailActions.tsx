'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AddToCartButton } from '@/components/site/AddToCartButton'
import { VariantSelector } from '@/components/site/VariantSelector'
import { Zap } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getVariantImageUrl(variant: any): string | null {
  if (!variant.product_images || variant.product_images.length === 0) return null
  const primary = variant.product_images.find((img: any) => img.is_primary) || variant.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

function getCartKey(): string {
  const host = window.location.hostname
  const subdomain = host.split('.')[0]
  return `cart_${subdomain}`
}

function addItemToCart(item: { id: number; name: string; price: number; imageUrl?: string; comparePrice?: number; variantAttributes?: Record<string, string> }) {
  const cartKey = getCartKey()
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
}

export function ProductDetailActions({
  product,
  variants,
  price,
  comparePrice,
  imageUrl,
  primaryColor,
  isParent
}: ProductDetailActionsProps) {
  const router = useRouter()

  const handleVariantSelect = (variant: any) => {
    const variantPrice = variant.product_prices?.[0]?.price || 0
    const variantComparePrice = variant.product_prices?.[0]?.compare_price
    const variantImgUrl = getVariantImageUrl(variant) || imageUrl
    addItemToCart({
      id: variant.id,
      name: variant.name,
      price: Number(variantPrice),
      ...(variantImgUrl && { imageUrl: variantImgUrl }),
      ...(variantComparePrice && { comparePrice: Number(variantComparePrice) }),
      ...(variant.variant_data && { variantAttributes: variant.variant_data })
    })
  }

  const handleBuyNowVariant = (variant: any) => {
    const variantPrice = variant.product_prices?.[0]?.price || 0
    const variantComparePrice = variant.product_prices?.[0]?.compare_price
    const variantImgUrl = getVariantImageUrl(variant) || imageUrl
    // Limpiar carrito y agregar solo este producto
    const cartKey = getCartKey()
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
    const cartKey = getCartKey()
    const item = {
      id: product.id,
      name: product.name,
      price: Number(price),
      quantity: 1,
      ...(imageUrl && { imageUrl }),
      ...(comparePrice && { comparePrice: Number(comparePrice) })
    }
    localStorage.setItem(cartKey, JSON.stringify([item]))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    router.push('/checkout')
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
      <AddToCartButton
        productId={product.id}
        productName={product.name}
        price={price}
        imageUrl={imageUrl}
        primaryColor={primaryColor}
        variant="full"
      />

      <Button
        size="lg"
        variant="outline"
        className="w-full"
        style={{ borderColor: primaryColor, color: primaryColor }}
        onClick={handleBuyNowSimple}
      >
        <Zap className="h-5 w-5 mr-2" />
        Comprar ahora
      </Button>
    </div>
  )
}
