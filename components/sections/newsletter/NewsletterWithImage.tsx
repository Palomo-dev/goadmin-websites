'use client'

interface NewsletterWithImageProps {
  content: Record<string, any>
  primaryColor?: string
}

export function NewsletterWithImage({ content, primaryColor = '#3B82F6' }: NewsletterWithImageProps) {
  const { title, subtitle, button_text, disclaimer, image_url } = content

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          {title && <h2 className="text-3xl font-bold mb-3">{title}</h2>}
          {subtitle && <p className="text-gray-600 dark:text-gray-300 mb-6">{subtitle}</p>}
          <div className="flex gap-2">
            <input type="email" placeholder="tu@email.com" className="flex-1 px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none" />
            <button className="px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity flex-shrink-0" style={{ backgroundColor: primaryColor }}>
              {button_text || 'Suscribirme'}
            </button>
          </div>
          {disclaimer && <p className="text-xs text-gray-400 mt-3">{disclaimer}</p>}
        </div>
        {image_url && (
          <div className="rounded-xl overflow-hidden aspect-[4/3] bg-gray-100">
            <img src={image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </section>
  )
}
