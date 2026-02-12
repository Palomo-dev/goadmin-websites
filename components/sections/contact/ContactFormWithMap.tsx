'use client'

interface ContactFormWithMapProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
}

export function ContactFormWithMap({ content, organization, primaryColor = '#3B82F6' }: ContactFormWithMapProps) {
  const { title, subtitle, show_phone, show_email, show_address } = content
  const address = organization?.address || ''
  const query = encodeURIComponent(address)

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold text-center mb-3">{title}</h2>}
        {subtitle && <p className="text-gray-600 text-center mb-10">{subtitle}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form className="bg-white rounded-xl border p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Nombre" className="px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none" />
              <input type="email" placeholder="Email" className="px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none" />
            </div>
            <input type="tel" placeholder="Teléfono" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none" />
            <textarea rows={4} placeholder="Mensaje" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none resize-none" />
            <button type="button" className="px-6 py-3 rounded-lg text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
              Enviar mensaje
            </button>
          </form>
          <div className="rounded-xl overflow-hidden min-h-[300px]">
            <iframe
              src={`https://maps.google.com/maps?q=${query}&output=embed`}
              className="w-full h-full border-0 min-h-[300px]"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
        {(show_phone || show_email || show_address) && (
          <div className="flex flex-wrap gap-8 justify-center mt-8 text-sm text-gray-600">
            {show_phone && organization?.phone && <span>📞 {organization.phone}</span>}
            {show_email && organization?.email && <span>✉️ {organization.email}</span>}
            {show_address && address && <span>📍 {address}</span>}
          </div>
        )}
      </div>
    </section>
  )
}
