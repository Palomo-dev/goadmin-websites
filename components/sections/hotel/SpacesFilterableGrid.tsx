'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, Users, MapPin, Bed, Filter, X, ChevronDown,
  Search, Moon, SlidersHorizontal, ArrowUpDown
} from 'lucide-react'

interface SpacesFilterableGridProps {
  spaces: any[]
  spaceTypes: any[]
  primaryColor: string
  layout?: 'cards' | 'detailed'
  showPrices?: boolean
  showCapacity?: boolean
  showAmenities?: boolean
}

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'capacity_asc' | 'capacity_desc'

export function SpacesFilterableGrid({
  spaces,
  spaceTypes,
  primaryColor,
  layout = 'cards',
  showPrices = true,
  showCapacity = true,
  showAmenities = true,
}: SpacesFilterableGridProps) {
  const searchParams = useSearchParams()

  // Booking params from URL
  const urlCheckin = searchParams.get('checkin') || ''
  const urlCheckout = searchParams.get('checkout') || ''
  const urlGuests = parseInt(searchParams.get('guests') || '0', 10)
  const urlAdults = searchParams.get('adults') || ''
  const urlChildren = searchParams.get('children') || ''
  const hasBookingParams = !!(urlCheckin && urlCheckout && urlGuests > 0)

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [minCapacity, setMinCapacity] = useState<number>(hasBookingParams ? urlGuests : 0)
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [showFilters, setShowFilters] = useState(false)

  // Extract unique values for filters
  const useSpaces = spaces.length > 0
  const items = useSpaces ? spaces : spaceTypes

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>()
    items.forEach((item: any) => {
      const name = useSpaces ? item.space_types?.name : item.name
      if (name) types.add(name)
    })
    return Array.from(types).sort()
  }, [items, useSpaces])

  const uniqueZones = useMemo(() => {
    const zones = new Set<string>()
    if (useSpaces) {
      items.forEach((item: any) => {
        if (item.floor_zone) zones.add(item.floor_zone)
      })
    }
    return Array.from(zones).sort()
  }, [items, useSpaces])

  // Calculate nights
  const nights = useMemo(() => {
    if (!urlCheckin || !urlCheckout) return 0
    const diff = Math.round(
      (new Date(urlCheckout + 'T12:00:00').getTime() - new Date(urlCheckin + 'T12:00:00').getTime()) /
      (1000 * 60 * 60 * 24)
    )
    return diff > 0 ? diff : 0
  }, [urlCheckin, urlCheckout])

  const fmtDate = (d: string) => {
    if (!d) return ''
    return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Apply filters
  const filteredItems = useMemo(() => {
    let result = [...items]

    // Filter by type
    if (typeFilter !== 'all') {
      result = result.filter((item: any) => {
        const name = useSpaces ? item.space_types?.name : item.name
        return name === typeFilter
      })
    }

    // Filter by zone
    if (zoneFilter !== 'all' && useSpaces) {
      result = result.filter((item: any) => item.floor_zone === zoneFilter)
    }

    // Filter by capacity
    if (minCapacity > 0) {
      result = result.filter((item: any) => {
        const cap = useSpaces ? (item.space_types?.capacity || 0) : (item.capacity || 0)
        return cap >= minCapacity
      })
    }

    // Sort
    if (sortBy !== 'default') {
      result.sort((a: any, b: any) => {
        const rateA = Number(useSpaces ? (a.space_types?.base_rate || 0) : (a.base_rate || 0))
        const rateB = Number(useSpaces ? (b.space_types?.base_rate || 0) : (b.base_rate || 0))
        const capA = useSpaces ? (a.space_types?.capacity || 0) : (a.capacity || 0)
        const capB = useSpaces ? (b.space_types?.capacity || 0) : (b.capacity || 0)

        switch (sortBy) {
          case 'price_asc': return rateA - rateB
          case 'price_desc': return rateB - rateA
          case 'capacity_asc': return capA - capB
          case 'capacity_desc': return capB - capA
          default: return 0
        }
      })
    }

    return result
  }, [items, useSpaces, typeFilter, zoneFilter, minCapacity, sortBy])

  const activeFilterCount = [
    typeFilter !== 'all',
    zoneFilter !== 'all',
    minCapacity > 0 && !hasBookingParams,
  ].filter(Boolean).length

  const clearFilters = () => {
    setTypeFilter('all')
    setZoneFilter('all')
    setMinCapacity(hasBookingParams ? urlGuests : 0)
    setSortBy('default')
  }

  // Build query string for space links
  const bookingQs = hasBookingParams
    ? `?checkin=${urlCheckin}&checkout=${urlCheckout}&guests=${urlGuests}${urlAdults ? `&adults=${urlAdults}` : ''}${urlChildren ? `&children=${urlChildren}` : ''}`
    : ''

  return (
    <div>
      {/* Booking Summary Banner */}
      {hasBookingParams && (
        <div className="mb-6 p-4 rounded-2xl border" style={{ backgroundColor: `${primaryColor}06`, borderColor: `${primaryColor}25` }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider block">Llegada</span>
                <p className="font-semibold text-gray-900 dark:text-white">{fmtDate(urlCheckin)}</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600 hidden sm:block">→</span>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider block">Salida</span>
                <p className="font-semibold text-gray-900 dark:text-white">{fmtDate(urlCheckout)}</p>
              </div>
              {nights > 0 && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wider block">Estancia</span>
                  <p className="font-semibold text-gray-900 dark:text-white">{nights} {nights === 1 ? 'noche' : 'noches'}</p>
                </div>
              )}
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider block">Huéspedes</span>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {urlAdults && `${urlAdults} ad.`}
                  {urlChildren && parseInt(urlChildren) > 0 ? ` · ${urlChildren} niñ.` : ''}
                  {!urlAdults && `${urlGuests}`}
                </p>
              </div>
            </div>
            <a href="/" className="text-sm font-medium hover:underline" style={{ color: primaryColor }}>
              Modificar búsqueda
            </a>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mobile toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Desktop filters (always visible) / Mobile filters (toggle) */}
          <div className={`${showFilters ? 'flex' : 'hidden'} lg:flex flex-wrap items-center gap-3 w-full lg:w-auto`}>
            {/* Tipo */}
            {uniqueTypes.length > 1 && (
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 transition-shadow cursor-pointer"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                >
                  <option value="all">Todos los tipos</option>
                  {uniqueTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <Bed className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Zona */}
            {uniqueZones.length > 1 && (
              <div className="relative">
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 transition-shadow cursor-pointer"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                >
                  <option value="all">Todas las zonas</option>
                  {uniqueZones.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Huéspedes mínimo */}
            {!hasBookingParams && (
              <div className="relative">
                <select
                  value={minCapacity}
                  onChange={(e) => setMinCapacity(Number(e.target.value))}
                  className="appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 transition-shadow cursor-pointer"
                  style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                >
                  <option value={0}>Cualquier capacidad</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}+ huéspedes</option>
                  ))}
                </select>
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Ordenar */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-300 focus:outline-none focus:ring-2 transition-shadow cursor-pointer"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              >
                <option value="default">Ordenar por</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
                <option value="capacity_asc">Capacidad: menor</option>
                <option value="capacity_desc">Capacidad: mayor</option>
              </select>
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Clear filters */}
            {(activeFilterCount > 0 || sortBy !== 'default') && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </button>
            )}
          </div>

          {/* Results count */}
          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {filteredItems.length === items.length
              ? `${items.length} ${items.length === 1 ? 'habitación' : 'habitaciones'}`
              : `${filteredItems.length} de ${items.length}`
            }
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {filteredItems.length > 0 ? (
        layout === 'detailed' ? (
          <div className="space-y-6">
            {filteredItems.map((item: any) => (
              <DetailedCard key={item.id} item={item} useSpaces={useSpaces} primaryColor={primaryColor}
                showPrices={showPrices} showCapacity={showCapacity} showAmenities={showAmenities}
                nights={nights} bookingQs={bookingQs} hasBookingParams={hasBookingParams} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item: any) => (
              <CompactCard key={item.id} item={item} useSpaces={useSpaces} primaryColor={primaryColor}
                showPrices={showPrices} showCapacity={showCapacity} showAmenities={showAmenities}
                nights={nights} bookingQs={bookingQs} hasBookingParams={hasBookingParams} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No se encontraron habitaciones</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Intenta ajustar los filtros para ver más opciones.</p>
          <button onClick={clearFilters} className="px-5 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>
            Ver todas las habitaciones
          </button>
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function DetailedCard({ item, useSpaces, primaryColor, showPrices, showCapacity, showAmenities, nights, bookingQs, hasBookingParams }: any) {
  const st = useSpaces ? item.space_types : null
  const label = useSpaces ? item.label : item.name
  const image = useSpaces ? item.primaryImage : item.image_url
  const capacity = useSpaces ? st?.capacity : item.capacity
  const baseRate = Number(useSpaces ? (st?.base_rate || 0) : (item.base_rate || 0))
  const typeName = useSpaces ? st?.name : null
  const floorZone = useSpaces ? item.floor_zone : null
  const description = item.description
  const services = useSpaces ? (item.services || []) : []

  return (
    <Link href={`/espacios/${item.id}${bookingQs}`}
      className="grid grid-cols-1 lg:grid-cols-[400px_1fr] bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-[16/10] lg:aspect-auto bg-gray-100 overflow-hidden">
        {image ? (
          <img src={image} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full min-h-[220px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}>
            <span className="text-6xl">🏨</span>
          </div>
        )}
        {typeName && (
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}cc` }}>
            {typeName}
          </span>
        )}
        {capacity && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 backdrop-blur-sm">
            👤 {capacity} máx
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col justify-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{label}</h3>
        {description && <p className="text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 text-sm">{description}</p>}

        <div className="flex flex-wrap gap-2 mb-4">
          {floorZone && (
            <span className="inline-flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-gray-600 dark:text-gray-300">
              <MapPin className="w-3.5 h-3.5" /> {floorZone}
            </span>
          )}
          {showCapacity && capacity && (
            <span className="inline-flex items-center gap-1 text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-gray-600 dark:text-gray-300">
              <Users className="w-3.5 h-3.5" /> {capacity} personas
            </span>
          )}
        </div>

        {showAmenities && services.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {services.slice(0, 5).map((svc: any, i: number) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                {svc.name}
              </span>
            ))}
            {services.length > 5 && <span className="px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">+{services.length - 5}</span>}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
          {showPrices && baseRate > 0 ? (
            <div>
              {hasBookingParams && nights > 0 ? (
                <>
                  <span className="text-xs text-gray-400">{nights} {nights === 1 ? 'noche' : 'noches'}</span>
                  <p className="font-bold text-2xl" style={{ color: primaryColor }}>
                    ${(baseRate * nights).toLocaleString('es-CO')}
                  </p>
                  <span className="text-xs text-gray-400">${baseRate.toLocaleString('es-CO')} /noche</span>
                </>
              ) : (
                <p className="font-bold text-2xl" style={{ color: primaryColor }}>
                  ${baseRate.toLocaleString('es-CO')} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ noche</span>
                </p>
              )}
            </div>
          ) : <div />}
          <span className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity group-hover:opacity-90" style={{ backgroundColor: primaryColor }}>
            {hasBookingParams ? 'Reservar' : 'Ver Detalle'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function CompactCard({ item, useSpaces, primaryColor, showPrices, showCapacity, showAmenities, nights, bookingQs, hasBookingParams }: any) {
  const st = useSpaces ? item.space_types : null
  const label = useSpaces ? item.label : item.name
  const image = useSpaces ? item.primaryImage : item.image_url
  const capacity = useSpaces ? st?.capacity : item.capacity
  const baseRate = Number(useSpaces ? (st?.base_rate || 0) : (item.base_rate || 0))
  const typeName = useSpaces ? st?.name : null
  const floorZone = useSpaces ? item.floor_zone : null
  const services = useSpaces ? (item.services || []) : []

  return (
    <Link href={`/espacios/${item.id}${bookingQs}`}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 group">
      <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
        {image ? (
          <img src={image} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}>
            <span className="text-5xl">🏨</span>
          </div>
        )}
        {typeName && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm" style={{ backgroundColor: `${primaryColor}cc` }}>
            {typeName}
          </span>
        )}
        {capacity && (
          <span className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium bg-white/90 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 backdrop-blur-sm">
            👤 {capacity} máx
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{label}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
          {floorZone && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {floorZone}</span>}
          {showCapacity && capacity && <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {capacity} pers.</span>}
        </div>
        {showAmenities && services.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {services.slice(0, 3).map((svc: any, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                {svc.name}
              </span>
            ))}
            {services.length > 3 && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">+{services.length - 3}</span>}
          </div>
        )}
        {showPrices && baseRate > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              {hasBookingParams && nights > 0 ? (
                <>
                  <p className="font-bold text-xl" style={{ color: primaryColor }}>${(baseRate * nights).toLocaleString('es-CO')}</p>
                  <span className="text-xs text-gray-400">{nights} {nights === 1 ? 'noche' : 'noches'} · ${baseRate.toLocaleString('es-CO')}/n</span>
                </>
              ) : (
                <p className="font-bold text-lg" style={{ color: primaryColor }}>
                  ${baseRate.toLocaleString('es-CO')} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ noche</span>
                </p>
              )}
            </div>
            <span className="px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-opacity group-hover:opacity-90" style={{ backgroundColor: primaryColor }}>
              {hasBookingParams ? 'Reservar' : 'Ver detalle'}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
