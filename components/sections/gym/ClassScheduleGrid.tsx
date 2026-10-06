import type { ClaseSeccion } from '@/lib/website/datosSecciones'
import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'

interface ClassScheduleGridProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
  /** `data.classes`: lo carga app/[[...slug]]/page.tsx (lib/website/datosSecciones.ts). */
  data?: { classes?: ClaseSeccion[] }
  organization?: { timezone?: string | null }
}

const NIVEL: Record<string, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
  all_levels: 'Todos los niveles',
}

/**
 * Día y hora en la zona de la organización. Este componente se pinta en el
 * servidor (UTC): sin `timeZone` las horas salían corridas.
 */
function formateadores(zona: string | null | undefined) {
  const timeZone = zona || ZONA_POR_DEFECTO
  try {
    return {
      dia: new Intl.DateTimeFormat('es-CO', { timeZone, weekday: 'long', day: 'numeric', month: 'short' }),
      hora: new Intl.DateTimeFormat('es-CO', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    }
  } catch {
    return formateadores(ZONA_POR_DEFECTO)
  }
}

export function ClassScheduleGrid({ content, primaryColor, data, organization }: ClassScheduleGridProps) {
  const classes = data?.classes || []
  const fmt = formateadores(organization?.timezone)

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}
      {classes.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
            {classes.map((cls, i) => (
              <div key={cls.id || i} className="border dark:border-gray-700 dark:bg-gray-800/50 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{cls.title}</h3>
                  {cls.difficulty_level && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {NIVEL[cls.difficulty_level] ?? cls.difficulty_level}
                    </span>
                  )}
                </div>
                {cls.instructor_name && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">🏋️ {cls.instructor_name}</p>
                )}
                {cls.start_at && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    🕐 {cls.recurrente ? 'Desde el ' : ''}{fmt.dia.format(new Date(cls.start_at))} · {fmt.hora.format(new Date(cls.start_at))}
                    {cls.end_at && ` – ${fmt.hora.format(new Date(cls.end_at))}`}
                  </p>
                )}
                {cls.room && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">📍 {cls.room}</p>}
                {cls.capacity !== null && cls.capacity > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium" style={{ color: primaryColor }}>
                      Cupo de {cls.capacity} {cls.capacity === 1 ? 'persona' : 'personas'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">📅</p>
          <p>Horario de clases próximamente</p>
        </div>
      )}
    </div>
  )
}
