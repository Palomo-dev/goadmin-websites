interface TripSearchFormProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
  }
  primaryColor?: string
}

export function TripSearchForm({ content, primaryColor }: TripSearchFormProps) {
  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      <form className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg dark:shadow-gray-900/30 p-6 md:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origen</label>
            <select className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none">
              <option value="">Selecciona origen</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destino</label>
            <select className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none">
              <option value="">Selecciona destino</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
            <input type="date" className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pasajeros</label>
            <select className="w-full px-4 py-2 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none">
              {[1,2,3,4,5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 text-center">
          <button
            type="button"
            className="px-8 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            {content.cta_text || 'Buscar Viajes'}
          </button>
        </div>
      </form>
    </div>
  )
}
