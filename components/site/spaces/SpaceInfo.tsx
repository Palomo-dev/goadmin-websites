import { Users, MapPin, Maximize2 } from 'lucide-react'

interface SpaceInfoProps {
  label: string
  floorZone?: string
  description?: string
  spaceType?: {
    name?: string
    capacity?: number
    area_sqm?: number
    base_rate?: number
  }
  primaryColor: string
}

export function SpaceInfo({ label, floorZone, description, spaceType, primaryColor }: SpaceInfoProps) {
  const st = spaceType

  return (
    <div>
      {/* Título + tipo */}
      <div className="mb-4">
        {st?.name && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 text-white" style={{ backgroundColor: primaryColor }}>
            {st.name}
          </span>
        )}
        <h1 className="text-3xl font-bold text-gray-900">{label}</h1>
      </div>

      {/* Meta: zona, capacidad, área */}
      <div className="flex flex-wrap items-center gap-4 text-gray-600 mb-6">
        {floorZone && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span>{floorZone}</span>
          </div>
        )}
        {st?.capacity && (
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>Hasta {st.capacity} personas</span>
          </div>
        )}
        {st?.area_sqm && (
          <div className="flex items-center gap-1.5">
            <Maximize2 className="h-4 w-4" />
            <span>{st.area_sqm} m²</span>
          </div>
        )}
      </div>

      {/* Descripción */}
      {description && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
          <p className="text-gray-600 leading-relaxed">{description}</p>
        </div>
      )}

      {/* Precio */}
      {st?.base_rate && (
        <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: `${primaryColor}08` }}>
          <span className="text-sm text-gray-500">Precio desde</span>
          <p className="text-3xl font-bold" style={{ color: primaryColor }}>
            ${Number(st.base_rate).toLocaleString()}
            <span className="text-base font-normal text-gray-500"> / noche</span>
          </p>
        </div>
      )}
    </div>
  )
}
