'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
}

interface FaqSectionProps {
  items: FaqItem[]
  primaryColor: string
}

export function FaqSection({ items, primaryColor }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  
  if (!items || items.length === 0) {
    return null
  }
  
  return (
    <section id="faq" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Encuentra respuestas a las preguntas más comunes
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          {items.map((item, index) => (
            <div 
              key={index}
              className="border-b border-gray-200"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full py-5 flex items-center justify-between text-left"
              >
                <span className="text-lg font-medium text-gray-900">
                  {item.question}
                </span>
                <ChevronDown 
                  className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              
              <div 
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === index ? 'max-h-96 pb-5' : 'max-h-0'
                }`}
              >
                <p className="text-gray-600 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
