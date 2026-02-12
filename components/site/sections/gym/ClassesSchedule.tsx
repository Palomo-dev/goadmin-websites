'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Clock, Users, Flame, MapPin } from 'lucide-react'

interface GymClass {
  id: number
  title: string
  description?: string
  class_type?: string
  difficulty_level?: string
  start_at: string
  end_at: string
  duration_minutes?: number
  capacity: number
  location?: string
  room?: string
  equipment_needed?: string
  recurrence?: any
  profiles?: {
    first_name?: string
    last_name?: string
    avatar_url?: string
  }
}

interface ClassesScheduleProps {
  classes?: GymClass[]
  reservationCounts?: Record<number, number>
  primaryColor: string
  onReserve?: (classId: number) => void
}

const defaultClasses: GymClass[] = [
  { id: 1, title: 'Spinning', start_at: new Date().toISOString(), end_at: new Date().toISOString(), duration_minutes: 45, capacity: 20, class_type: 'cardio', difficulty_level: 'high', profiles: { first_name: 'María', last_name: 'G.' } },
  { id: 2, title: 'Yoga', start_at: new Date().toISOString(), end_at: new Date().toISOString(), duration_minutes: 60, capacity: 15, class_type: 'flexibility', difficulty_level: 'low', profiles: { first_name: 'Ana', last_name: 'P.' } },
  { id: 3, title: 'CrossFit', start_at: new Date().toISOString(), end_at: new Date().toISOString(), duration_minutes: 50, capacity: 12, class_type: 'strength', difficulty_level: 'high', profiles: { first_name: 'Carlos', last_name: 'R.' } },
  { id: 4, title: 'Zumba', start_at: new Date().toISOString(), end_at: new Date().toISOString(), duration_minutes: 45, capacity: 25, class_type: 'dance', difficulty_level: 'medium', profiles: { first_name: 'Laura', last_name: 'M.' } },
]

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const typeEmojis: Record<string, string> = {
  cardio: '�', strength: '🏋️', flexibility: '🧘', dance: '💃',
  martial_arts: '🥊', hiit: '🔥', pilates: '🤸', swimming: '🏊',
  yoga: '🧘', spinning: '🚴', crossfit: '🏋️', zumba: '💃',
}

function getDifficultyStyle(level?: string) {
  switch (level?.toLowerCase()) {
    case 'high': case 'alta': return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Alta' }
    case 'medium': case 'media': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Media' }
    case 'low': case 'baja': return { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Baja' }
    default: return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: level || '' }
  }
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function ClassesSchedule({ classes: propClasses, reservationCounts = {}, primaryColor, onReserve }: ClassesScheduleProps) {
  const classes = propClasses && propClasses.length > 0 ? propClasses : defaultClasses
  const hasRealData = propClasses && propClasses.length > 0

  // Obtener los días únicos disponibles
  const availableDays = useMemo(() => {
    if (!hasRealData) return [1, 2, 3, 4, 5, 6] // Lun-Sab por defecto
    const days = new Set(classes.map(c => new Date(c.start_at).getDay()))
    return Array.from(days).sort()
  }, [classes, hasRealData])

  const [selectedDay, setSelectedDay] = useState(availableDays[0] ?? 1)

  // Filtrar clases por día seleccionado
  const filteredClasses = useMemo(() => {
    if (!hasRealData) return classes
    return classes.filter(c => new Date(c.start_at).getDay() === selectedDay)
  }, [classes, selectedDay, hasRealData])

  return (
    <section className="py-16 bg-gray-900 text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span 
            className="inline-block px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{ backgroundColor: `${primaryColor}30`, color: primaryColor }}
          >
            Clases Grupales
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Horario de Clases
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {hasRealData
              ? `${classes.length} clases disponibles esta semana`
              : 'Más de 50 clases semanales con los mejores instructores'}
          </p>
        </div>
        
        {/* Day selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {availableDays.map((dayIdx) => (
            <button
              key={dayIdx}
              onClick={() => setSelectedDay(dayIdx)}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedDay === dayIdx
                  ? 'text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              style={selectedDay === dayIdx ? { backgroundColor: primaryColor } : {}}
            >
              {DAYS[dayIdx]}
            </button>
          ))}
        </div>
        
        {/* Classes grid */}
        {filteredClasses.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay clases programadas para este día</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredClasses.map((cls) => {
              const instructor = cls.profiles
              const instructorName = instructor
                ? `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim()
                : ''
              const emoji = typeEmojis[cls.class_type?.toLowerCase() || ''] || '🏃'
              const diff = getDifficultyStyle(cls.difficulty_level)
              const reserved = reservationCounts[cls.id] || 0
              const spotsLeft = cls.capacity - reserved
              const isFull = spotsLeft <= 0

              return (
                <div 
                  key={cls.id}
                  className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-4xl">{emoji}</span>
                    {cls.difficulty_level && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${diff.bg} ${diff.text}`}>
                        <Flame className="w-3 h-3 inline mr-1" />
                        {diff.label}
                      </span>
                    )}
                  </div>
                  
                  <h4 className="font-bold text-lg mb-1">{cls.title}</h4>
                  {instructorName && (
                    <p className="text-gray-400 text-sm mb-3">con {instructorName}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-1">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {hasRealData ? formatTime(cls.start_at) : '07:00'}
                    </span>
                    <span>{cls.duration_minutes || 60}min</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {hasRealData 
                        ? (isFull ? 'Lleno' : `${spotsLeft} cupos`)
                        : `${cls.capacity} cupos`}
                    </span>
                    {cls.room && (
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {cls.room}
                      </span>
                    )}
                  </div>
                  
                  <Button 
                    size="sm" 
                    className="w-full mt-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: isFull ? '#666' : primaryColor }}
                    disabled={isFull}
                    onClick={() => onReserve?.(cls.id)}
                  >
                    {isFull ? 'Sin cupos' : 'Reservar Cupo'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
