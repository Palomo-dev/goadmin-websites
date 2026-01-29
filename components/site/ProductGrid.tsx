'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ShoppingCart, Plus, Check } from 'lucide-react'

interface Product {
  id: number
  name: string
  description?: string
  category_id?: number
  product_prices?: { price: number; currency_code?: string }[]
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
}

export function ProductGrid({ products, categories, primaryColor, organizationSubdomain }: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())
  
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category_id === selectedCategory)
    : products
  
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
      existingCart.push({
        id: product.id,
        name: product.name,
        price: Number(price),
        quantity: 1
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
                <Link href={`/productos/${product.id}`}>
                  <div 
                    className="aspect-square flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)` 
                    }}
                  >
                    <span className="text-5xl opacity-50">📦</span>
                  </div>
                </Link>
                
                <CardContent className="p-4">
                  <Link href={`/productos/${product.id}`}>
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
    </div>
  )
}
