'use client'

interface NewsletterBannerProps {
  content: Record<string, any>
  primaryColor?: string
}

export function NewsletterBanner({ content, primaryColor = '#3B82F6' }: NewsletterBannerProps) {
  const { title, subtitle, button_text, disclaimer } = content

  return (
    <section className="py-16 px-4" style={{ backgroundColor: primaryColor }}>
      <div className="max-w-3xl mx-auto text-center text-white">
        {title && <h2 className="text-3xl font-bold mb-3">{title}</h2>}
        {subtitle && <p className="mb-6 opacity-90">{subtitle}</p>}
        <div className="flex gap-2 max-w-md mx-auto">
          <input type="email" placeholder="tu@email.com" className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:ring-2 focus:outline-none" />
          <button className="px-6 py-3 rounded-lg bg-white dark:bg-gray-100 font-medium hover:bg-gray-100 dark:hover:bg-gray-200 transition-colors flex-shrink-0" style={{ color: primaryColor }}>
            {button_text || 'Suscribirme'}
          </button>
        </div>
        {disclaimer && <p className="text-xs mt-3 opacity-70">{disclaimer}</p>}
      </div>
    </section>
  )
}
