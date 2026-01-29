'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Heart, Eye, Star, ArrowRight } from 'lucide-react'

interface Product {
  id: number
  name: string
  description?: string
  product_prices?: { price: number; compare_price?: number }[]
}

interface FeaturedProductsProps {
  products: Product[]
  primaryColor: string
  title?: string
  subtitle?: string
  onAddToCart?: (product: Product) => void
}

export function FeaturedProducts({ 
  products, 
  primaryColor, 
  title = "Productos Destacados",
  subtitle = "Los favoritos de nuestros clientes",
  onAddToCart 
}: FeaturedProductsProps) {
  const [wishlist, setWishlist] = useState<Set<number>>(new Set())
  
  const toggleWishlist = (id: number) => {
    setWishlist(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  
  if (products.length === 0) return null
  
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              {title}
            </h2>
            <p className="text-gray-600">{subtitle}</p>
          </div>
          <Link 
            href="/productos"
            className="hidden md:flex items-center font-medium hover:underline"
            style={{ color: primaryColor }}
          >
            Ver todos
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.slice(0, 8).map((product) => {
            const price = product.product_prices?.[0]
            const hasDiscount = price?.compare_price && price.compare_price > price.price
            
            return (
              <Card key={product.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="relative">
                  <Link href={`/productos/${product.id}`}>
                    <div 
                      className="aspect-square flex items-center justify-center relative overflow-hidden"
                      style={{ 
                        background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` 
                      }}
                    >
                      <span className="text-6xl opacity-60 group-hover:scale-110 transition-transform duration-300">
                        📦
                      </span>
                      
                      {/* Quick actions overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform">
                          <Eye className="w-5 h-5 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </Link>
                  
                  {/* Wishlist button */}
                  <button
                    onClick={() => toggleWishlist(product.id)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <Heart 
                      className={`w-5 h-5 ${wishlist.has(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
                    />
                  </button>
                  
                  {/* Discount badge */}
                  {hasDiscount && (
                    <span className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                      -{Math.round((1 - price.price / price.compare_price!) * 100)}%
                    </span>
                  )}
                </div>
                
                <CardContent className="p-4">
                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="text-sm text-gray-500 ml-1">(4.8)</span>
                  </div>
                  
                  <Link href={`/productos/${product.id}`}>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {price && (
                        <>
                          <span 
                            className="text-xl font-bold"
                            style={{ color: primaryColor }}
                          >
                            ${Number(price.price).toLocaleString()}
                          </span>
                          {hasDiscount && (
                            <span className="text-sm text-gray-400 line-through">
                              ${Number(price.compare_price).toLocaleString()}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    
                    <Button 
                      size="sm"
                      onClick={() => onAddToCart?.(product)}
                      style={{ backgroundColor: primaryColor }}
                      className="hover:opacity-90"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        <div className="text-center mt-8 md:hidden">
          <Link href="/productos">
            <Button variant="outline" style={{ borderColor: primaryColor, color: primaryColor }}>
              Ver todos los productos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
