'use client'

import { useState } from 'react'

interface ExpandableDescriptionProps {
  text: string
  maxLength?: number
}

export function ExpandableDescription({ text, maxLength = 200 }: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false)
  const shouldTruncate = text.length > maxLength

  return (
    <div>
      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
        {shouldTruncate && !expanded ? `${text.slice(0, maxLength)}...` : text}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
