interface DemoCtaFormProps {
  content: {
    title?: string
    subtitle?: string
    cta_text?: string
    show_form?: boolean
  }
  primaryColor?: string
}

export function DemoCtaForm({ content, primaryColor }: DemoCtaFormProps) {
  return (
    <div className="text-center">
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 mb-8">{content.subtitle}</p>
      )}
      {content.show_form !== false ? (
        <form className="max-w-lg mx-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="text" placeholder="Nombre" className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none" />
            <input type="email" placeholder="Email corporativo" className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none" />
          </div>
          <input type="text" placeholder="Empresa" className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none" />
          <select className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent focus:ring-2 focus:outline-none text-gray-500">
            <option value="">¿Cuántos empleados?</option>
            <option value="1-10">1-10</option>
            <option value="11-50">11-50</option>
            <option value="51-200">51-200</option>
            <option value="200+">200+</option>
          </select>
          <button
            type="button"
            className="w-full px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            {content.cta_text || 'Solicitar Demo'}
          </button>
          <p className="text-xs text-gray-400">Sin compromiso. Te contactaremos en menos de 24h.</p>
        </form>
      ) : (
        <button
          type="button"
          className="px-8 py-4 rounded-lg text-white font-medium text-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          {content.cta_text || 'Solicitar Demo'}
        </button>
      )}
    </div>
  )
}
