'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Flame, Leaf, Star, ArrowRight } from 'lucide-react'

interface Product {
  id: number
  name: string
  description?: string
  category_id?: number
  product_prices?: { price: number }[]
}

interface Category {
  id: number
  name: string
  slug: string
}

interface MenuPreviewProps {
  products: Product[]
  categories: Category[]
  primaryColor: string
}

export function MenuPreview({ products, categories, primaryColor }: MenuPreviewProps) {
  const [activeCategory, setActiveCategory] = useState<number | null>(
    categories[0]?.id || null
  )
  
  const filteredProducts = activeCategory 
    ? products.filter(p => p.category_id === activeCategory)
    : products
  
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span 
            className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            Nuestra Carta
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Descubre Nuestro Menú
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Platos preparados con ingredientes frescos y de la mejor calidad
          </p>
        </div>
        
        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {categories.slice(0, 6).map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-3 rounded-full font-medium transition-all ${
                  activeCategory === category.id 
                    ? 'text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={activeCategory === category.id ? { backgroundColor: primaryColor } : {}}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
        
        {/* Menu grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {filteredProducts.slice(0, 8).map((item) => {
            const price = item.product_prices?.[0]
            
            return (
              <Card key={item.id} className="group hover:shadow-lg transition-all">
                <CardContent className="p-6 flex gap-4">
                  <div 
                    className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <span className="text-3xl">🍽️</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {item.name}
                      </h4>
                      {price && (
                        <span 
                          className="font-bold text-lg"
                          style={{ color: primaryColor }}
                        >
                          ${Number(price.price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    
                    {/* Tags */}
                    <div className="flex gap-2 mt-2">
                      <span className="inline-flex items-center text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                        <Flame className="w-3 h-3 mr-1" />
                        Popular
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        <div className="text-center mt-10">
          <Link href="/productos">
            <Button size="lg" style={{ backgroundColor: primaryColor }}>
              Ver Menú Completo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
