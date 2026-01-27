'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'

interface Testimonial {
  name: string
  role?: string
  company?: string
  content: string
  avatar?: string
  rating?: number
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[]
  primaryColor: string
}

export function TestimonialsSection({ testimonials, primaryColor }: TestimonialsSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  
  if (!testimonials || testimonials.length === 0) {
    return null
  }
  
  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }
  
  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }
  
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Lo que dicen nuestros clientes
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Testimonios de clientes satisfechos
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          {/* Carousel */}
          <div className="relative">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 md:p-12">
                {/* Rating */}
                {testimonials[currentIndex].rating && (
                  <div className="flex justify-center mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-6 w-6 ${
                          i < (testimonials[currentIndex].rating || 0)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Quote */}
                <blockquote className="text-xl md:text-2xl text-gray-700 text-center mb-8 leading-relaxed">
                  "{testimonials[currentIndex].content}"
                </blockquote>
                
                {/* Author */}
                <div className="flex items-center justify-center">
                  {testimonials[currentIndex].avatar ? (
                    <Image
                      src={testimonials[currentIndex].avatar!}
                      alt={testimonials[currentIndex].name}
                      width={56}
                      height={56}
                      className="rounded-full mr-4"
                    />
                  ) : (
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {testimonials[currentIndex].name.charAt(0)}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">
                      {testimonials[currentIndex].name}
                    </p>
                    {(testimonials[currentIndex].role || testimonials[currentIndex].company) && (
                      <p className="text-gray-500 text-sm">
                        {testimonials[currentIndex].role}
                        {testimonials[currentIndex].role && testimonials[currentIndex].company && ' - '}
                        {testimonials[currentIndex].company}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Navigation buttons */}
            {testimonials.length > 1 && (
              <>
                <button
                  onClick={prevTestimonial}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6 text-gray-600" />
                </button>
                <button
                  onClick={nextTestimonial}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight className="h-6 w-6 text-gray-600" />
                </button>
              </>
            )}
          </div>
          
          {/* Dots */}
          {testimonials.length > 1 && (
            <div className="flex justify-center mt-8 gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-gray-800' : 'bg-gray-300'
                  }`}
                  style={index === currentIndex ? { backgroundColor: primaryColor } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
