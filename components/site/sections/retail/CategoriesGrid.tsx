'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Category {
  id: number
  name: string
  slug: string
  description?: string
  image_url?: string
}

interface CategoriesGridProps {
  categories: Category[]
  primaryColor: string
}

const categoryIcons: Record<string, string> = {
  'ropa': '👕',
  'electronica': '📱',
  'hogar': '🏠',
  'deportes': '⚽',
  'belleza': '💄',
  'juguetes': '🎮',
  'libros': '📚',
  'alimentos': '🍎',
  'default': '📦'
}

export function CategoriesGrid({ categories, primaryColor }: CategoriesGridProps) {
  if (categories.length === 0) return null
  
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Explora por Categorías
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Encuentra exactamente lo que buscas navegando por nuestras categorías
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.slice(0, 8).map((category) => {
            const icon = categoryIcons[category.slug?.toLowerCase()] || categoryIcons.default
            
            return (
              <Link
                key={category.id}
                href={`/productos?categoria=${category.id}`}
                className="group relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
              >
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                />
                
                <div className="relative z-10">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    {icon}
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {category.name}
                  </h3>
                  
                  {category.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                  
                  <div 
                    className="flex items-center text-sm font-medium mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: primaryColor }}
                  >
                    Ver productos
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
        
        {categories.length > 8 && (
          <div className="text-center mt-8">
            <Link
              href="/categorias"
              className="inline-flex items-center font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              Ver todas las categorías
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
