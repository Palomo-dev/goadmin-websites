'use client'

import { useState, useEffect, useMemo } from 'react'

export interface CountdownConfig {
  countdown_enabled?: boolean
  countdown_mode?: 'custom' | 'daily_reset'
  countdown_end_date?: string // ISO string para modo custom
  countdown_timezone?: string // ej: 'America/Bogota'
  countdown_reset_hour?: number // hora de reset diario (0-23)
  countdown_title?: string
  countdown_show_in_header?: boolean
  countdown_show_in_cart?: boolean
  countdown_show_in_product?: boolean
  countdown_show_in_hero?: boolean
}

interface CountdownBannerProps {
  config: CountdownConfig
  primaryColor: string
  variant?: 'full' | 'banner' | 'inline' | 'compact'
  className?: string
}

interface TimeLeft {
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

function getTargetDate(config: CountdownConfig): Date | null {
  if (!config.countdown_enabled) return null

  if (config.countdown_mode === 'custom' && config.countdown_end_date) {
    return new Date(config.countdown_end_date)
  }

  if (config.countdown_mode === 'daily_reset') {
    const tz = config.countdown_timezone || 'America/Bogota'
    const resetHour = config.countdown_reset_hour ?? 0

    // Obtener la hora actual en la zona horaria configurada
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(now)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0'
    
    const currentHourInTz = parseInt(getPart('hour'))
    
    // Si la hora actual ya pasó la hora de reset, el target es mañana a esa hora
    // Si no ha pasado, el target es hoy a esa hora
    const todayInTz = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    
    let targetDate: Date
    if (currentHourInTz >= resetHour) {
      // Target es mañana a la hora de reset
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const tomorrowFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour12: false,
      })
      const tParts = tomorrowFormatter.formatToParts(tomorrow)
      const tGetPart = (type: string) => tParts.find(p => p.type === type)?.value || '0'
      const tomorrowStr = `${tGetPart('year')}-${tGetPart('month')}-${tGetPart('day')}T${String(resetHour).padStart(2, '0')}:00:00`
      targetDate = new Date(new Date(tomorrowStr).toLocaleString('en-US', { timeZone: tz }))
      // Crear fecha en la timezone correcta
      const tomorrowTarget = new Date(`${tGetPart('year')}-${tGetPart('month')}-${tGetPart('day')}T${String(resetHour).padStart(2, '0')}:00:00`)
      // Ajustar al offset de la timezone
      const offset = now.getTime() - new Date(todayInTz + 'T' + getPart('hour') + ':' + getPart('minute') + ':' + getPart('second')).getTime()
      targetDate = new Date(tomorrowTarget.getTime() + offset)
    } else {
      // Target es hoy a la hora de reset
      const todayTarget = new Date(`${todayInTz}T${String(resetHour).padStart(2, '0')}:00:00`)
      const offset = now.getTime() - new Date(todayInTz + 'T' + getPart('hour') + ':' + getPart('minute') + ':' + getPart('second')).getTime()
      targetDate = new Date(todayTarget.getTime() + offset)
    }
    
    return targetDate
  }

  return null
}

function calculateTimeLeft(targetDate: Date | null): TimeLeft {
  if (!targetDate) return { hours: 0, minutes: 0, seconds: 0, expired: true }
  
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()
  
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true }
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  
  return { hours, minutes, seconds, expired: false }
}

export function CountdownBanner({ config, primaryColor, variant = 'banner', className = '' }: CountdownBannerProps) {

  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ hours: 0, minutes: 0, seconds: 0, expired: true })
  const [mounted, setMounted] = useState(false)

  const targetDate = useMemo(() => getTargetDate(config), [
    config.countdown_enabled,
    config.countdown_mode,
    config.countdown_end_date,
    config.countdown_timezone,
    config.countdown_reset_hour,
  ])

  useEffect(() => {
    setMounted(true)
    if (!targetDate) return

    const update = () => setTimeLeft(calculateTimeLeft(targetDate))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  if (!mounted || !config.countdown_enabled || timeLeft.expired) return null

  const title = config.countdown_title || '¡Oferta por tiempo limitado!'
  const pad = (n: number) => String(n).padStart(2, '0')

  // Variante full (sección de página grande y llamativa)
  if (variant === 'full') {
    return (
      <div
        className={`w-full py-8 sm:py-12 px-4 text-white relative overflow-hidden ${className}`}
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc, ${primaryColor}ee)` }}
      >
        {/* Decoración de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white rounded-full translate-x-1/4 translate-y-1/4" />
          <div className="absolute top-1/2 left-1/3 w-20 h-20 bg-white rounded-full" />
        </div>
        
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl animate-bounce">🔥</span>
            <span className="text-2xl animate-bounce" style={{ animationDelay: '0.1s' }}>⚡</span>
          </div>
          
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 tracking-tight">
            {title}
          </h3>
          <p className="text-white/80 text-sm sm:text-base mb-6">¡No te pierdas esta oportunidad!</p>
          
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <div className="flex flex-col items-center">
              <span className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-mono font-bold text-3xl sm:text-4xl md:text-5xl shadow-lg border border-white/10">
                {pad(timeLeft.hours)}
              </span>
              <span className="text-xs sm:text-sm mt-2 text-white/70 font-medium uppercase tracking-wider">Horas</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-white/60 -mt-6">:</span>
            <div className="flex flex-col items-center">
              <span className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-mono font-bold text-3xl sm:text-4xl md:text-5xl shadow-lg border border-white/10">
                {pad(timeLeft.minutes)}
              </span>
              <span className="text-xs sm:text-sm mt-2 text-white/70 font-medium uppercase tracking-wider">Minutos</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-white/60 -mt-6">:</span>
            <div className="flex flex-col items-center">
              <span className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-mono font-bold text-3xl sm:text-4xl md:text-5xl shadow-lg border border-white/10">
                {pad(timeLeft.seconds)}
              </span>
              <span className="text-xs sm:text-sm mt-2 text-white/70 font-medium uppercase tracking-wider">Segundos</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Variante banner (barra delgada debajo del header)
  if (variant === 'banner') {
    return (
      <div
        className={`w-full py-3 px-4 text-white ${className}`}
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4 flex-wrap">
          <span className="text-lg animate-pulse">🔥</span>
          <span className="font-semibold text-sm sm:text-base tracking-wide">{title} Finaliza en:</span>
          <div className="flex items-center gap-1.5 font-mono font-bold text-lg sm:text-xl">
            <span className="bg-white/20 backdrop-blur-sm rounded-md px-2 py-1 min-w-[2.5rem] text-center">{pad(timeLeft.hours)}</span>
            <span className="text-white/80">:</span>
            <span className="bg-white/20 backdrop-blur-sm rounded-md px-2 py-1 min-w-[2.5rem] text-center">{pad(timeLeft.minutes)}</span>
            <span className="text-white/80">:</span>
            <span className="bg-white/20 backdrop-blur-sm rounded-md px-2 py-1 min-w-[2.5rem] text-center">{pad(timeLeft.seconds)}</span>
          </div>
          <span className="text-lg animate-pulse">🔥</span>
        </div>
      </div>
    )
  }

  // Variante inline (tarjeta con borde, para dentro de secciones)
  if (variant === 'inline') {
    return (
      <div
        className={`rounded-xl p-4 sm:p-5 text-center shadow-sm ${className}`}
        style={{ backgroundColor: `${primaryColor}08`, border: `1.5px solid ${primaryColor}25` }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: primaryColor }}>
          ⏰ {title}
        </p>
        <div className="flex items-center justify-center gap-2 font-mono font-bold text-2xl" style={{ color: primaryColor }}>
          <div className="flex flex-col items-center">
            <span className="bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm border border-gray-100 dark:border-gray-700">{pad(timeLeft.hours)}</span>
            <span className="text-[10px] font-normal mt-1 text-gray-500">hrs</span>
          </div>
          <span className="text-lg -mt-3">:</span>
          <div className="flex flex-col items-center">
            <span className="bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm border border-gray-100 dark:border-gray-700">{pad(timeLeft.minutes)}</span>
            <span className="text-[10px] font-normal mt-1 text-gray-500">min</span>
          </div>
          <span className="text-lg -mt-3">:</span>
          <div className="flex flex-col items-center">
            <span className="bg-white dark:bg-gray-800 rounded-lg px-3 py-1.5 shadow-sm border border-gray-100 dark:border-gray-700">{pad(timeLeft.seconds)}</span>
            <span className="text-[10px] font-normal mt-1 text-gray-500">seg</span>
          </div>
        </div>
      </div>
    )
  }

  // Variante compact (una línea, para espacios pequeños)
  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${className}`}
        style={{ backgroundColor: `${primaryColor}12`, border: `1px solid ${primaryColor}20` }}
      >
        <span className="text-xs">⏰</span>
        <span className="font-medium text-xs" style={{ color: primaryColor }}>{title}</span>
        <span className="font-mono font-bold" style={{ color: primaryColor }}>
          {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
        </span>
      </div>
    )
  }

  return null
}
