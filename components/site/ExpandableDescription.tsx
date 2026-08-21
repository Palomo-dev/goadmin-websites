'use client'

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'

interface ExpandableDescriptionProps {
  text: string
  maxLength?: number
}

// Verifica si una línea es un "título" (todo en mayúsculas, sin puntuación final, corto)
function isHeading(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 60) return false
  if (trimmed.endsWith('.') || trimmed.endsWith(':') || trimmed.endsWith(',')) return false
  // Al menos 60% de letras mayúsculas
  const letters = trimmed.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '')
  if (letters.length < 3) return false
  const upper = letters.replace(/[a-záéíóúñ]/g, '')
  return upper.length / letters.length > 0.6
}

// Verifica si una línea es un bullet (•, -, *, ·)
function isBullet(line: string): boolean {
  const trimmed = line.trim()
  return /^[•·\-*]\s+/.test(trimmed) || /^[•·\-*]$/.test(trimmed)
}

// Limpia el prefijo del bullet
function cleanBullet(line: string): string {
  return line.trim().replace(/^[•·\-*]\s*/, '').trim()
}

// Verifica si una línea es un separador (---, ===, ___)
function isSeparator(line: string): boolean {
  const trimmed = line.trim()
  return /^(-{3,}|={3,}|_{3,})$/.test(trimmed)
}

// Renderiza texto con markdown básico: **negrita**, *cursiva*, __negrita__, _cursiva_
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // **negrita** o __negrita__
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/) || remaining.match(/^(.*?)__(.+?)__/)
    if (boldMatch) {
      if (boldMatch[1]) parts.push(boldMatch[1])
      parts.push(<strong key={key++} className="font-bold text-gray-900 dark:text-white">{boldMatch[2]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // *cursiva* o _cursiva_
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*/) || remaining.match(/^(.*?)_(.+?)_/)
    if (italicMatch && !italicMatch[0].includes('**')) {
      if (italicMatch[1]) parts.push(italicMatch[1])
      parts.push(<em key={key++} className="italic">{italicMatch[2]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Sin más markdown, agregar el resto
    parts.push(remaining)
    break
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

// Convierte texto plano con \n, bullets, headings y separadores a JSX
function renderRichText(text: string): React.ReactNode {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let currentList: string[] = []
  let key = 0

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push(
        <ul key={key++} className="list-none space-y-1 my-2 pl-1">
          {currentList.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-300 leading-relaxed">
              <span className="text-gray-400 mt-1 shrink-0">•</span>
              <span>{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  for (const line of lines) {
    if (isSeparator(line)) {
      flushList()
      blocks.push(<hr key={key++} className="my-4 border-gray-200 dark:border-gray-700" />)
      continue
    }

    if (isBullet(line)) {
      const cleaned = cleanBullet(line)
      if (cleaned) currentList.push(cleaned)
      continue
    }

    // Línea vacía: cerrar lista actual
    if (line.trim() === '') {
      flushList()
      continue
    }

    // Si es un heading
    if (isHeading(line)) {
      flushList()
      blocks.push(
        <h4 key={key++} className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wide mt-4 mb-2">
          {renderInlineMarkdown(line.trim())}
        </h4>
      )
      continue
    }

    // Línea normal de texto
    flushList()
    blocks.push(
      <p key={key++} className="text-gray-600 dark:text-gray-300 leading-relaxed mb-2">
        {renderInlineMarkdown(line.trim())}
      </p>
    )
  }

  flushList()
  return <>{blocks}</>
}

export function ExpandableDescription({ text, maxLength = 200 }: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false)
  const shouldTruncate = text.length > maxLength

  const renderedContent = useMemo(() => {
    if (shouldTruncate && !expanded) {
      // En estado colapsado, mostrar texto plano truncado
      return (
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          {text.slice(0, maxLength)}...
        </p>
      )
    }
    return renderRichText(text)
  }, [text, expanded, maxLength, shouldTruncate])

  return (
    <div>
      {renderedContent}
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium transition-colors"
          style={{ color: 'var(--primary-color, #2563eb)' }}
        >
          {expanded ? 'Ver menos' : 'Ver más'}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
