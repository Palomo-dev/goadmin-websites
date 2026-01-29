'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Clock, Users, Flame } from 'lucide-react'

interface ClassesScheduleProps {
  primaryColor: string
}

const classes = [
  { name: 'Spinning', time: '06:00', duration: '45min', instructor: 'María G.', intensity: 'Alta', emoji: '🚴' },
  { name: 'Yoga', time: '07:00', duration: '60min', instructor: 'Ana P.', intensity: 'Baja', emoji: '🧘' },
  { name: 'CrossFit', time: '08:00', duration: '50min', instructor: 'Carlos R.', intensity: 'Alta', emoji: '🏋️' },
  { name: 'Zumba', time: '09:00', duration: '45min', instructor: 'Laura M.', intensity: 'Media', emoji: '💃' },
  { name: 'Body Pump', time: '10:00', duration: '55min', instructor: 'Diego S.', intensity: 'Alta', emoji: '💪' },
  { name: 'Pilates', time: '17:00', duration: '50min', instructor: 'Sofia V.', intensity: 'Media', emoji: '🤸' },
  { name: 'Box Fitness', time: '18:00', duration: '45min', instructor: 'Roberto L.', intensity: 'Alta', emoji: '🥊' },
  { name: 'Stretching', time: '19:00', duration: '30min', instructor: 'Paula D.', intensity: 'Baja', emoji: '🙆' },
]

const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function ClassesSchedule({ primaryColor }: ClassesScheduleProps) {
  const [selectedDay, setSelectedDay] = useState(0)
  
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
            Más de 50 clases semanales con los mejores instructores
          </p>
        </div>
        
        {/* Day selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {days.map((day, idx) => (
            <button
              key={day}
              onClick={() => setSelectedDay(idx)}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedDay === idx 
                  ? 'text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              style={selectedDay === idx ? { backgroundColor: primaryColor } : {}}
            >
              {day}
            </button>
          ))}
        </div>
        
        {/* Classes grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {classes.map((cls, idx) => (
            <div 
              key={idx}
              className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-4xl">{cls.emoji}</span>
                <span 
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    cls.intensity === 'Alta' 
                      ? 'bg-red-500/20 text-red-400'
                      : cls.intensity === 'Media'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  <Flame className="w-3 h-3 inline mr-1" />
                  {cls.intensity}
                </span>
              </div>
              
              <h4 className="font-bold text-lg mb-1">{cls.name}</h4>
              <p className="text-gray-400 text-sm mb-3">con {cls.instructor}</p>
              
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {cls.time}
                </span>
                <span>{cls.duration}</span>
              </div>
              
              <Button 
                size="sm" 
                className="w-full mt-4 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Reservar Cupo
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
