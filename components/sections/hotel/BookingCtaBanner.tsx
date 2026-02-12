import Link from 'next/link'

interface BookingCtaBannerProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    cta_url?: string
    show_form?: boolean
  }
  primaryColor?: string
}

export function BookingCtaBanner({ content, primaryColor }: BookingCtaBannerProps) {
  return (
    <div>
      {content.show_form !== false ? (
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-center mb-6">
            {content.title || 'Reserva tu Estadía'}
          </h2>
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
              <input type="date" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
              <input type="date" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Huéspedes</label>
              <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none">
                {[1,2,3,4,5,6].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'huésped' : 'huéspedes'}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="w-full px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                {content.cta_text || 'Buscar Disponibilidad'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{content.title || 'Reserva tu Estadía'}</h2>
          {content.subtitle && <p className="text-gray-600 mb-6">{content.subtitle}</p>}
          <Link
            href={content.cta_url || '/reservas'}
            className="inline-block px-8 py-4 rounded-lg text-white font-medium text-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            {content.cta_text || 'Reservar Ahora'}
          </Link>
        </div>
      )}
    </div>
  )
}
