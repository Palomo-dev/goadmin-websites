'use client'

import { useState, useEffect, useMemo } from 'react'
import { instanteFin, objetivoVigente, proximoReinicio } from '@/lib/website/contadorColumnas'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { leerEstiloContador } from '@/lib/website/estiloContador'
import { ContadorConEstilo } from './ContadorConEstilo'

/**
 * Texto y dígitos sobre el primario: `--texto-sobre-primario` (lo emite el layout de la tienda) y,
 * donde no existe (checkout, fuera del layout), el mismo cálculo aquí; blanco si el color no es hex.
 */
export function colorSobrePrimario(primario: string): string {
  return `var(--texto-sobre-primario, ${textoSobreAcentoSiHex(primario) ?? '#ffffff'})`
}

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
  /** Estilo personalizado (jsonb). Ausente/NULL/{} = el contador de siempre. */
  countdown_style?: unknown
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
    // «AAAA-MM-DDTHH:mm» (datetime-local del editor) se lee en la zona elegida, no en la del visitante.
    return instanteFin(config.countdown_end_date, config.countdown_timezone)
  }

  if (config.countdown_mode === 'daily_reset') {
    // Zona inválida → Bogotá; medianoche como 00 (antes Chrome daba «24» y se ocultaba de 00:00 a 00:59).
    return proximoReinicio(new Date(), config.countdown_timezone, config.countdown_reset_hour ?? 0)
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

  const objetivoInicial = useMemo(() => getTargetDate(config), [
    config.countdown_enabled,
    config.countdown_mode,
    config.countdown_end_date,
    config.countdown_timezone,
    config.countdown_reset_hour,
  ])

  useEffect(() => {
    setMounted(true)
    if (!objetivoInicial) return

    // Reinicio diario: al cruzar la hora se toma el siguiente objetivo y sigue contando sin recargar.
    let objetivo: Date | null = objetivoInicial
    const update = () => {
      objetivo = objetivoVigente(objetivo, new Date(), config)
      setTimeLeft(calculateTimeLeft(objetivo))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la config relevante ya está en objetivoInicial
  }, [objetivoInicial])

  if (!mounted || !config.countdown_enabled || timeLeft.expired) return null

  const title = config.countdown_title || '¡Oferta por tiempo limitado!'
  const pad = (n: number) => String(n).padStart(2, '0')

  // Estilo personalizado: una sola configuración para todas las ubicaciones; cambia solo la forma.
  const estilo = leerEstiloContador(config.countdown_style)
  if (estilo) {
    const forma = variant === 'banner' ? 'barra' : variant === 'full' ? 'grande' : variant === 'compact' ? 'compacto' : 'tarjeta'
    const segundos = timeLeft.hours * 3600 + timeLeft.minutes * 60 + timeLeft.seconds
    return <ContadorConEstilo estilo={estilo} primaryColor={primaryColor} titulo={title} segundos={segundos} forma={forma} className={className} />
  }

  // Variante full (sección de página grande y llamativa)
  if (variant === 'full') {
    return (
      <div
        className={`w-full py-8 sm:py-12 px-4 relative overflow-hidden ${className}`}
        style={{ color: colorSobrePrimario(primaryColor), background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc, ${primaryColor}ee)` }}
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
          <p className="opacity-80 text-sm sm:text-base mb-6">¡No te pierdas esta oportunidad!</p>
          
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <div className="flex flex-col items-center">
              <span className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-mono font-bold text-3xl sm:text-4xl md:text-5xl shadow-lg border border-white/10">
                {pad(timeLeft.hours)}
              </span>
              <span className="text-xs sm:text-sm mt-2 opacity-70 font-medium uppercase tracking-wider">Horas</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold opacity-60 -mt-6">:</span>
            <div className="flex flex-col items-center">
              <span className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-mono font-bold text-3xl sm:text-4xl md:text-5xl shadow-lg border border-white/10">
                {pad(timeLeft.minutes)}
              </span>
              <span className="text-xs sm:text-sm mt-2 opacity-70 font-medium uppercase tracking-wider">Minutos</span>
            </div>
            <span className="text-2xl sm:text-3xl font-bold opacity-60 -mt-6">:</span>
            <div className="flex flex-col items-center">
              <span className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 sm:px-6 sm:py-4 font-mono font-bold text-3xl sm:text-4xl md:text-5xl shadow-lg border border-white/10">
                {pad(timeLeft.seconds)}
              </span>
              <span className="text-xs sm:text-sm mt-2 opacity-70 font-medium uppercase tracking-wider">Segundos</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Variante banner (barra delgada debajo del header). Siempre una línea: en celular se oculta el 🔥
  // final, baja la letra y el título se recorta con «…» si no cabe.
  if (variant === 'banner') {
    const sobre = colorSobrePrimario(primaryColor)
    return (
      <div
        className={`w-full py-2 px-3 sm:px-4 text-center text-[13px] sm:text-sm font-medium ${className}`}
        style={{ backgroundColor: primaryColor, color: sobre }}
        data-contador="banner"
      >
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-nowrap">
          <span className="animate-pulse shrink-0">🔥</span>
          <span className="min-w-0 truncate">{title}</span>
          <div className="flex shrink-0 items-center gap-1 font-mono font-bold text-sm sm:text-base">
            <span className="bg-white/20 rounded px-1.5 py-0.5">{pad(timeLeft.hours)}</span>
            <span>:</span>
            <span className="bg-white/20 rounded px-1.5 py-0.5">{pad(timeLeft.minutes)}</span>
            <span>:</span>
            <span className="bg-white/20 rounded px-1.5 py-0.5">{pad(timeLeft.seconds)}</span>
          </div>
          <span className="animate-pulse hidden sm:inline">🔥</span>
        </div>
      </div>
    )
  }

  // Variante inline (para cart y producto)
  if (variant === 'inline') {
    return (
      <div
        className={`rounded-lg p-3 text-center ${className}`}
        data-contador="inline"
        style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30`, borderWidth: '1px' }}
      >
        <p className="text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
          ⏰ {title}
        </p>
        <div className="flex items-center justify-center gap-1 font-mono font-bold text-lg text-gray-900 dark:text-gray-100">
          <span className="bg-white dark:bg-gray-800 rounded px-2 py-0.5 shadow-sm">{pad(timeLeft.hours)}</span>
          <span>:</span>
          <span className="bg-white dark:bg-gray-800 rounded px-2 py-0.5 shadow-sm">{pad(timeLeft.minutes)}</span>
          <span>:</span>
          <span className="bg-white dark:bg-gray-800 rounded px-2 py-0.5 shadow-sm">{pad(timeLeft.seconds)}</span>
        </div>
      </div>
    )
  }

  // Variante compact (para espacios pequeños)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-xs">⏰</span>
        <span className="font-mono font-semibold" style={{ color: primaryColor }}>
          {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
        </span>
      </div>
    )
  }

  return null
}
