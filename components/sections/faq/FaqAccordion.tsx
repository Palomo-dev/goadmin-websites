'use client'

import { useState } from 'react'

interface FaqAccordionProps {
  content: {
    title?: string
    subtitle?: string
    items?: Array<{
      question: string
      answer: string
    }>
  }
  primaryColor?: string
}

export function FaqAccordion({ content, primaryColor }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const items = content.items || []

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-10">{content.subtitle}</p>
      )}
      <div className="max-w-3xl mx-auto divide-y dark:divide-gray-700">
        {items.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between py-5 text-left"
            >
              <span className="font-medium text-lg pr-4 text-gray-900 dark:text-white">{item.question}</span>
              <span
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-transform"
                style={{ backgroundColor: primaryColor, transform: openIndex === i ? 'rotate(45deg)' : 'none' }}
              >
                +
              </span>
            </button>
            {openIndex === i && (
              <div className="pb-5 text-gray-600 dark:text-gray-300 leading-relaxed">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">❓</p>
          <p>Preguntas frecuentes próximamente</p>
        </div>
      )}
    </div>
  )
}
