'use client'

import { useState, type CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { buildCardStyle } from '@/lib/sectionStyle'

interface ProductFAQProps {
  content: Record<string, any>
  data?: Record<string, any>
  primaryColor?: string
}

export function ProductFAQ({ content }: ProductFAQProps) {
  const title = content.title || 'Preguntas frecuentes'
  const layout = content.layout || 'accordion'
  const items = (content.items || []) as Array<{ question: string; answer: string }>
  const gap = content.gap ?? 8

  const { className: cardClassName, style: cardStyle } = buildCardStyle(content)

  if (items.length === 0) return null

  // JSON-LD FAQPage para SEO
  const faqJsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>

      {layout === 'accordion' ? (
        <div className="space-y-2" style={{ gap: `${gap}px` }}>
          {items.map((item, i) => (
            <FAQItem key={i} question={item.question} answer={item.answer} cardClassName={cardClassName} cardStyle={cardStyle} />
          ))}
        </div>
      ) : (
        <div className="space-y-4" style={{ gap: `${gap}px` }}>
          {items.map((item, i) => (
            <div key={i} className={`border-b dark:border-gray-700 pb-4 ${cardClassName}`} style={cardStyle}>
              <p className="font-medium text-gray-900 dark:text-white mb-1">{item.question}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{item.answer}</p>
            </div>
          ))}
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  )
}

function FAQItem({ question, answer, cardClassName, cardStyle }: { question: string; answer: string; cardClassName?: string; cardStyle?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border rounded-lg dark:border-gray-700 overflow-hidden ${cardClassName ?? ''}`} style={cardStyle}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-gray-900 dark:text-white text-sm">{question}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-300">
          {answer}
        </div>
      )}
    </div>
  )
}
