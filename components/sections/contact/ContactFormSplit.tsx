interface ContactFormSplitProps {
  content: {
    title?: string
    show_map?: boolean
    show_phone?: boolean
    show_email?: boolean
    show_address?: boolean
  }
  organization: any
  primaryColor?: string
}

export function ContactFormSplit({ content, organization, primaryColor }: ContactFormSplitProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <div>
        {content.title && (
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{content.title}</h2>
        )}
        <form className="space-y-4">
          <input type="text" placeholder="Nombre completo" className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2" />
          <input type="email" placeholder="Email" className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2" />
          <input type="tel" placeholder="Teléfono" className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2" />
          <textarea placeholder="Mensaje" rows={4} className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-transparent dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2 resize-none" />
          <button
            type="submit"
            className="w-full py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor || '#8B6914' }}
          >
            Enviar
          </button>
        </form>
      </div>
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Información de Contacto</h3>
        {organization.phone && (
          <div className="flex items-start gap-3">
            <span className="text-xl">📞</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Teléfono</p>
              <p className="text-gray-600 dark:text-gray-400">{organization.phone}</p>
            </div>
          </div>
        )}
        {organization.email && (
          <div className="flex items-start gap-3">
            <span className="text-xl">✉️</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Email</p>
              <p className="text-gray-600 dark:text-gray-400">{organization.email}</p>
            </div>
          </div>
        )}
        {organization.address && (
          <div className="flex items-start gap-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Dirección</p>
              <p className="text-gray-600 dark:text-gray-400">{organization.address}</p>
              {organization.city && <p className="text-gray-600 dark:text-gray-400">{organization.city}, {organization.state}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
