'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AddToCartButton } from '@/components/site/AddToCartButton'
import { VariantSelector } from '@/components/site/VariantSelector'

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

  const handleVariantSelect = (variant: any) => {
    const variantPrice = variant.product_prices?.[0]?.price || 0
    const variantComparePrice = variant.product_prices?.[0]?.compare_price
    const host = window.location.hostname
    const subdomain = host.split('.')[0]
    const cartKey = `cart_${subdomain}`
    const existingCart = JSON.parse(localStorage.getItem(cartKey) || '[]')

    const existingIndex = existingCart.findIndex((item: any) => item.id === variant.id)
    if (existingIndex >= 0) {
      existingCart[existingIndex].quantity += 1
    } else {
      existingCart.push({
        id: variant.id,
        name: variant.name,
        price: Number(variantPrice),
        quantity: 1,
        ...(variantComparePrice && { comparePrice: Number(variantComparePrice) })
      })
    }

    localStorage.setItem(cartKey, JSON.stringify(existingCart))
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
        asChild
      >
        <Link href="/checkout">
          Comprar ahora
        </Link>
      </Button>
    </div>
  )
}
