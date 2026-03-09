import { Suspense } from 'react'
import { SpacesFilterableGrid } from './SpacesFilterableGrid'

interface SpacesCardsProps {
  content: {
    title?: string
    subtitle?: string
    max_items?: number
  }
  primaryColor?: string
  data?: { spaces?: any[]; spaceTypes?: any[] }
}

export function SpacesCards({ content, primaryColor, data }: SpacesCardsProps) {
  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 text-center mb-8">{content.subtitle}</p>
      )}
      <Suspense fallback={<div className="text-center py-12 text-gray-400">Cargando habitaciones...</div>}>
        <SpacesFilterableGrid
          spaces={data?.spaces || []}
          spaceTypes={data?.spaceTypes || []}
          primaryColor={primaryColor || '#8B6914'}
          layout="cards"
        />
      </Suspense>
    </div>
  )
}
