import Link from 'next/link'

interface CtaBannerProps {
  content: {
    title?: string
    cta_text?: string
    cta_url?: string
  }
  primaryColor?: string
}

export function CtaBanner({ content, primaryColor }: CtaBannerProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
      {content.title && (
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.cta_text && (
        <Link
          href={content.cta_url || '#'}
          className="inline-block px-8 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{ backgroundColor: primaryColor || '#8B6914' }}
        >
          {content.cta_text}
        </Link>
      )}
    </div>
  )
}
