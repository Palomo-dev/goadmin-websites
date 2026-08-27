interface ClassScheduleGridProps {
  content: {
    title?: string
    subtitle?: string
  }
  primaryColor?: string
  data?: { classes?: any[] }
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function ClassScheduleGrid({ content, primaryColor, data }: ClassScheduleGridProps) {
  const classes = data?.classes || []

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
            {classes.map((cls: any, i: number) => (
              <div key={cls.id || i} className="border dark:border-gray-700 dark:bg-gray-800/50 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">{cls.title || cls.name}</h3>
                  {cls.difficulty_level && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {cls.difficulty_level}
                    </span>
                  )}
                </div>
                {cls.instructor_name && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">🏋️ {cls.instructor_name}</p>
                )}
                {cls.start_at && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    🕐 {new Date(cls.start_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    {cls.end_at && ` - ${new Date(cls.end_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                )}
                {cls.room && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">📍 {cls.room}</p>}
                {cls.capacity && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium" style={{ color: primaryColor }}>
                      {cls.available_spots ?? cls.capacity} cupos
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
