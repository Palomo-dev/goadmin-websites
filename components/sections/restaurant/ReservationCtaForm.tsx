import Link from 'next/link'

interface ReservationCtaFormProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    show_form?: boolean
  }
  primaryColor?: string
  organization?: any
}

export function ReservationCtaForm({ content, primaryColor }: ReservationCtaFormProps) {
  return (
    <div className="text-center">
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 mb-8">{content.subtitle}</p>
      )}

      {content.show_form !== false ? (
        <form className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
            <input type="date" className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none" style={{ '--tw-ring-color': primaryColor } as any} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora</label>
            <input type="time" className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personas</label>
            <select className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none">
              {[1,2,3,4,5,6,7,8].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button
              type="button"
              className="w-full px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              {content.cta_text || 'Reservar Mesa'}
            </button>
          </div>
        </form>
      ) : (
        <Link
          href={content.cta_url || '/reservas'}
          className="inline-block px-8 py-4 rounded-lg text-white font-medium text-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          {content.cta_text || 'Reservar Mesa'}
        </Link>
      )}
    </div>
  )
}
