'use client'

import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { filasHorario, normalizarDias, parseHorario } from '@/lib/restaurant/horario'
import { urlMapaEmbebido } from '@/lib/maps/comoLlegar'

interface MapEmbeddedProps {
  content: Record<string, any>
  organization?: any
  primaryColor?: string
}

export function MapEmbedded({ content, organization, primaryColor = '#3B82F6' }: MapEmbeddedProps) {
  const { horarioSede } = useRutaSitio()
  const title = content.title || 'Encuéntranos'
  const address = organization?.address || content.address || ''
  const mapa = urlMapaEmbebido({ direccion: address })

  // Horario legible: el de la sede (el mismo del pie) o, si no, business_hours con los días en
  // español. Antes se pintaba JSON.stringify: «Horario {}» en 47 sitios. Vacío → sin bloque.
  const horario = horarioSede ?? parseHorario(normalizarDias(organization?.website_settings?.business_hours))
  const filas = horario ? filasHorario(horario, null) : []

  return (
    <div>
      {title && <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{title}</h2>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 rounded-xl overflow-hidden min-h-[350px]">
          {mapa ? (
            <iframe
              src={mapa}
              title={`Mapa: ${address}`}
              className="w-full h-full min-h-[350px] border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="w-full h-full min-h-[350px] bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
              No hay dirección configurada
            </div>
          )}
        </div>
        <div className="space-y-6">
          {content.show_address !== false && address && (
            <div>
              <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">Dirección</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{address}</p>
              {organization?.city && <p className="text-gray-600 dark:text-gray-400 text-sm">{organization.city}, {organization?.state}</p>}
            </div>
          )}
          {content.show_hours !== false && filas.length > 0 && (
            <div>
              <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">Horario</h3>
              <dl className="text-sm">
                {filas.map((fila) => (
                  <div key={fila.etiqueta} className="flex justify-between gap-4 py-0.5">
                    <dt className="text-gray-600 dark:text-gray-400">{fila.etiqueta}</dt>
                    <dd className="text-gray-900 dark:text-gray-200 text-right">{fila.horas ?? 'Cerrado'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {organization?.phone && (
            <div>
              <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">Teléfono</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{organization.phone}</p>
            </div>
          )}
          {organization?.email && (
            <div>
              <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">Email</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{organization.email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
