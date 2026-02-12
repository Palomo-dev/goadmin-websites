interface ContactFormDefaultProps {
  content: {
    title?: string
    subtitle?: string
  }
  organization: any
  primaryColor?: string
}

export function ContactFormDefault({ content, organization, primaryColor }: ContactFormDefaultProps) {
  return (
    <div className="max-w-2xl mx-auto">
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-8">{content.subtitle}</p>
      )}
      <form className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="Nombre" className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2" style={{ '--tw-ring-color': primaryColor } as any} />
          <input type="email" placeholder="Email" className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2" />
        </div>
        <input type="text" placeholder="Asunto" className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2" />
        <textarea placeholder="Mensaje" rows={5} className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 resize-none" />
        <button
          type="submit"
          className="w-full py-3 rounded-lg text-white font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor || '#8B6914' }}
        >
          Enviar Mensaje
        </button>
      </form>
    </div>
  )
}
