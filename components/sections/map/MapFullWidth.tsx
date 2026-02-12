'use client'

interface MapFullWidthProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
}

export function MapFullWidth({ content, organization, primaryColor = '#3B82F6' }: MapFullWidthProps) {
  const address = organization?.address || content.address || ''
  const query = encodeURIComponent(address)

  return (
    <section className="w-full">
      <iframe
        src={`https://maps.google.com/maps?q=${query}&output=embed`}
        className="w-full h-[400px] md:h-[500px] border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  )
}
