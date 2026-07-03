import { Suspense } from 'react'
import { SpacesFilterableGrid } from './SpacesFilterableGrid'

interface SpacesDetailedProps {
  content: {
    title?: string
    show_prices?: boolean
    show_amenities?: boolean
    show_capacity?: boolean
  }
  primaryColor?: string
  data?: { spaces?: any[]; spaceTypes?: any[] }
}

export function SpacesDetailed({ content, primaryColor, data }: SpacesDetailedProps) {
  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      <Suspense fallback={<div className="text-center py-12 text-gray-400">Cargando habitaciones...</div>}>
        <SpacesFilterableGrid
          spaces={data?.spaces || []}
          spaceTypes={data?.spaceTypes || []}
          primaryColor={primaryColor || '#8B6914'}
          layout="detailed"
          showPrices={content.show_prices !== false}
          showCapacity={content.show_capacity !== false}
          showAmenities={content.show_amenities !== false}
        />
      </Suspense>
    </div>
  )
}
