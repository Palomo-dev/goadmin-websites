'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Check, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getImageUrl(product: any): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  const primary = product.product_images.find((img: any) => img.is_primary) || product.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

interface RelatedProductsProps {
  products: any[]
  primaryColor: string
  currentProductId: number
}

export function RelatedProducts({ products, primaryColor, currentProductId }: RelatedProductsProps) {
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())

  // Filtrar el producto actual
  const relatedProducts = products.filter(p => p.id !== currentProductId).slice(0, 8)

  if (relatedProducts.length === 0) return null

  const addToCart = (product: any) => {
    const price = product.product_prices?.[0]?.price
    if (!price) return

    const host = window.location.hostname
    const subdomain = host.split('.')[0]
    const cartKey = `cart_${subdomain}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')

    const existingIndex = cart.findIndex((item: any) => item.id === product.id)
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += 1
    } else {
      const imgUrl = getImageUrl(product)
      const cp = product.product_prices?.[0]?.compare_price
      cart.push({
        id: product.id,
        name: product.name,
        price: Number(price),
        quantity: 1,
        ...(imgUrl && { imageUrl: imgUrl }),
        ...(cp && { comparePrice: Number(cp) })
      })
    }

    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => { const n = new Set(prev); n.delete(product.id); return n })
    }, 1500)
  }

  return (
    <div className="mt-16 border-t pt-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Productos relacionados</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {relatedProducts.map((product: any) => {
          const price = product.product_prices?.[0]?.price
          const comparePrice = product.product_prices?.[0]?.compare_price
          const imgUrl = getImageUrl(product)
          const isAdded = addedToCart.has(product.id)
          const discount = comparePrice && price && Number(comparePrice) > Number(price)
            ? Math.round((1 - Number(price) / Number(comparePrice)) * 100)
            : null

          return (
            <div
              key={product.id}
              className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all"
            >
              <Link href={`/productos/${product.uuid}`}>
                <div className="aspect-square bg-gray-100 overflow-hidden relative">
                  {discount && (
                    <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      -{discount}%
                    </span>
                  )}
                  {imgUrl ? (
                    <Image
                      src={imgUrl}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3">
                <Link href={`/productos/${product.uuid}`}>
                  <h3 className="font-medium text-sm text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors">
                    {product.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-2 mt-2">
                  {comparePrice && Number(comparePrice) > Number(price) && (
                    <span className="text-xs text-gray-400 line-through">${Number(comparePrice).toLocaleString()}</span>
                  )}
                  {price && (
                    <span className="font-bold text-sm" style={{ color: primaryColor }}>
                      ${Number(price).toLocaleString()}
                    </span>
                  )}
                </div>
                {price && !product.is_parent && (
                  <Button
                    size="sm"
                    onClick={() => addToCart(product)}
                    className={`w-full mt-2 text-xs transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''}`}
                    style={!isAdded ? { backgroundColor: primaryColor } : {}}
                  >
                    {isAdded ? <><Check className="h-3 w-3 mr-1" />Agregado</> : <><Plus className="h-3 w-3 mr-1" />Agregar</>}
                  </Button>
                )}
                {product.is_parent && (
                  <Link href={`/productos/${product.uuid}`}>
                    <Button size="sm" className="w-full mt-2 text-xs bg-purple-600 hover:bg-purple-700">
                      Ver opciones
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
