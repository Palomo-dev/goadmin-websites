/**
 * F9.4 — Sección category_seo_text.
 *
 * Bloque de texto al pie de la categoría, útil para SEO.
 * No afecta la UI interactiva; es contenido estático indexable.
 */

export const CONTENT_KEYS = ['title', 'content'] as const

interface CategorySeoTextProps {
  content: {
    title?: string
    content?: string
  }
  primaryColor?: string
}

export function CategorySeoText({ content }: CategorySeoTextProps) {
  const title = content.title
  const text = content.content

  if (!title && !text) return null

  return (
    <div className="mt-12 pt-8 border-t dark:border-gray-700">
      {title && (
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      )}
      {text && (
        <div className="prose prose-sm dark:prose-invert max-w-3xl text-gray-600 dark:text-gray-400">
          <p>{text}</p>
        </div>
      )}
    </div>
  )
}
