'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Check, Package, Layers } from 'lucide-react'
import { VariantSelector } from './VariantSelector'

interface ProductImage {
  id: number
  storage_path: string | null
  is_primary: boolean
  display_order: number
  shared_image_id: number | null
  shared_images?: {
    storage_path: string
  } | null
}

interface StockLevel {
  qty_on_hand: number
  qty_reserved: number
}

interface Product {
  id: number
  uuid: string
  name: string
  description?: string
  category_id?: number
  is_parent?: boolean
  has_variants?: boolean
  variant_count?: number
  product_prices?: { price: number; currency_code?: string }[]
  product_images?: ProductImage[]
  stock_levels?: StockLevel[]
}

function getAvailableStock(product: Product): number | null {
  if (!product.stock_levels || product.stock_levels.length === 0) return null
  return product.stock_levels.reduce(
    (sum, sl) => sum + (Number(sl.qty_on_hand) - Number(sl.qty_reserved)), 0
  )
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getProductImageUrl(product: Product): string | null {
  if (!product.product_images || product.product_images.length === 0) return null
  
  // Buscar imagen primaria primero
  const primaryImage = product.product_images.find(img => img.is_primary)
  const image = primaryImage || product.product_images[0]
  
  // Obtener el path de storage
  const storagePath = image.storage_path || image.shared_images?.storage_path
  
  if (!storagePath) return null
  
  // Construir URL de Supabase Storage (bucket: product-images)
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${storagePath}`
}

interface Category {
  id: number
  name: string
  slug: string
}

interface ProductGridProps {
  products: Product[]
  categories: Category[]
  primaryColor: string
  organizationSubdomain: string
  organizationId?: number
}

export function ProductGrid({ products, categories, primaryColor, organizationSubdomain, organizationId }: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  const [variantParent, setVariantParent] = useState<Product | null>(null)
  const [variantChildren, setVariantChildren] = useState<any[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category_id === selectedCategory)
    : products
  
  const openVariantSelector = async (product: Product) => {
    if (!organizationId) return
    setVariantParent(product)
    setLoadingVariants(true)
    try {
      const res = await fetch(`/api/products/${product.id}/variants?organizationId=${organizationId}`)
      const data = await res.json()
      setVariantChildren(data.variants || [])
    } catch (err) {
      console.error('Error loading variants:', err)
      setVariantChildren([])
    } finally {
      setLoadingVariants(false)
    }
  }

  const addToCart = (product: Product) => {
    const price = product.product_prices?.[0]?.price || 0
    
    // Obtener carrito actual
    const cartKey = `cart_${organizationSubdomain}`
    const existingCart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    
    // Buscar si ya existe el producto
    const existingIndex = existingCart.findIndex((item: any) => item.id === product.id)
    
    if (existingIndex >= 0) {
      existingCart[existingIndex].quantity += 1
    } else {
      const imgUrl = getProductImageUrl(product)
      existingCart.push({
        id: product.id,
        name: product.name,
        price: Number(price),
        quantity: 1,
        ...(imgUrl && { imageUrl: imgUrl })
      })
    }
    
    localStorage.setItem(cartKey, JSON.stringify(existingCart))
    
    // Mostrar feedback
    setAddedToCart(prev => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 1500)
    
    // Disparar evento para actualizar el header si tiene contador de carrito
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }
  
  return (
    <div>
      {/* Filtro por categorías */}
      {categories.length > 0 && (
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === null 
                  ? 'text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={selectedCategory === null ? { backgroundColor: primaryColor } : {}}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id 
                    ? 'text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={selectedCategory === category.id ? { backgroundColor: primaryColor } : {}}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Grid de productos */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const price = product.product_prices?.[0]
            const isAdded = addedToCart.has(product.id)
            
            return (
              <Card key={product.id} className="group overflow-hidden hover:shadow-lg transition-all h-full">
                <Link href={`/productos/${product.uuid}`}>
                  <div 
                    className="aspect-square flex items-center justify-center relative overflow-hidden"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` 
                    }}
                  >
                    {(() => {
                      const stock = getAvailableStock(product)
                      return stock !== null && stock <= 0 ? (
                        <span className="absolute top-2 left-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          Agotado
                        </span>
                      ) : null
                    })()}
                    {product.has_variants && (product.variant_count ?? 0) > 0 && (
                      <span className="absolute top-2 right-2 z-10 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {product.variant_count} variantes
                      </span>
                    )}
                    {getProductImageUrl(product) ? (
                      <Image
                        src={getProductImageUrl(product)!}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <Package className="h-16 w-16 opacity-30" style={{ color: primaryColor }} />
                    )}
                  </div>
                </Link>
                
                <CardContent className="p-4">
                  <Link href={`/productos/${product.uuid}`}>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  
                  {product.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    {price && (
                      <span 
                        className="text-lg font-bold"
                        style={{ color: primaryColor }}
                      >
                        ${Number(price.price).toLocaleString()}
                      </span>
                    )}
                    
                    {(() => {
                      const stock = getAvailableStock(product)
                      const outOfStock = stock !== null && stock <= 0
                      const isParent = product.has_variants && (product.variant_count ?? 0) > 0
                      return outOfStock && !isParent ? (
                        <span className="text-xs text-red-500 font-medium">Sin stock</span>
                      ) : isParent ? (
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            openVariantSelector(product)
                          }}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Layers className="h-4 w-4 mr-1" />
                          Elegir
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            addToCart(product)
                          }}
                          className={`transition-all ${isAdded ? 'bg-green-500 hover:bg-green-600' : ''}`}
                          style={!isAdded ? { backgroundColor: primaryColor } : {}}
                        >
                          {isAdded ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Agregado
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar
                            </>
                          )}
                        </Button>
                      )
                    })()}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">
            {selectedCategory 
              ? 'No hay productos en esta categoría.' 
              : 'No hay productos disponibles en este momento.'}
          </p>
          {selectedCategory && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setSelectedCategory(null)}
            >
              Ver todos los productos
            </Button>
          )}
        </div>
      )}
      {/* Variant Selector Dialog */}
      {variantParent && (
        <VariantSelector
          parentName={variantParent.name}
          variants={variantChildren}
          primaryColor={primaryColor}
          mode="dialog"
          onClose={() => { setVariantParent(null); setVariantChildren([]) }}
          onSelect={(variant) => {
            addToCart(variant as any)
            setVariantParent(null)
            setVariantChildren([])
          }}
        />
      )}
    </div>
  )
}
