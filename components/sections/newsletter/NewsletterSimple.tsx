interface NewsletterSimpleProps {
  content: {
    title?: string
    subtitle?: string
    button_text?: string
    disclaimer?: string
  }
  primaryColor?: string
}

export function NewsletterSimple({ content, primaryColor }: NewsletterSimpleProps) {
  return (
    <div className="max-w-xl mx-auto text-center">
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 mb-6">{content.subtitle}</p>
      )}
      <form className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          placeholder="Tu email"
          className="flex-1 px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none"
        />
        <button
          type="button"
          className="px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: primaryColor }}
        >
          {content.button_text || 'Suscribirme'}
        </button>
      </form>
      {content.disclaimer && (
        <p className="text-xs text-gray-400 mt-3">{content.disclaimer}</p>
      )}
    </div>
  )
}
