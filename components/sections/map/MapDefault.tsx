interface MapDefaultProps {
  content: {
    title?: string
  }
  organization: any
}

export function MapDefault({ content, organization }: MapDefaultProps) {
  const address = [organization.address, organization.city, organization.state, organization.country]
    .filter(Boolean)
    .join(', ')

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl font-bold text-center mb-6">{content.title}</h2>
      )}
      {address ? (
        <div className="rounded-xl overflow-hidden border dark:border-gray-700" style={{ height: '400px' }}>
          <iframe
            src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Ubicación"
          />
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p>No hay dirección configurada</p>
        </div>
      )}
    </div>
  )
}
