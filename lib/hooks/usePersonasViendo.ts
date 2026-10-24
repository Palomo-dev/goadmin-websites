'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { INTERVALO_PRESENCIA_MS, rutaPresencia, sesionPresenciaValida } from '@/lib/website/presenciaPagina'

/** Heartbeat solo con la opción activa y la pestaña visible. No escribe visitas analíticas. */
export function usePersonasViendo(activo: boolean): number | null {
  const pathname = usePathname()
  const ruta = rutaPresencia(pathname)
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    setTotal(null)
    if (!activo || !ruta) return
    let sesion: string
    try {
      const guardada = sessionStorage.getItem('gw-presencia-sesion')
      sesion = sesionPresenciaValida(guardada) ? guardada : crypto.randomUUID()
      sessionStorage.setItem('gw-presencia-sesion', sesion)
    } catch { return }
    const controller = new AbortController()
    let pendiente = false
    const actualizar = async () => {
      if (document.visibilityState !== 'visible' || pendiente) return
      pendiente = true
      const intento = new AbortController()
      const cancelar = () => intento.abort()
      controller.signal.addEventListener('abort', cancelar, { once: true })
      const limite = setTimeout(cancelar, 10_000)
      try {
        const response = await fetch('/api/website/presencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruta, sesion }), signal: intento.signal })
        const resultado: { total?: unknown } = response.ok ? await response.json() : {}
        if (!controller.signal.aborted) setTotal(typeof resultado.total === 'number' && Number.isInteger(resultado.total) && resultado.total > 0 ? resultado.total : null)
      } catch { if (!controller.signal.aborted) setTotal(null) }
      finally { clearTimeout(limite); controller.signal.removeEventListener('abort', cancelar); pendiente = false }
    }
    void actualizar()
    const timer = setInterval(() => { void actualizar() }, INTERVALO_PRESENCIA_MS)
    document.addEventListener('visibilitychange', actualizar)
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', actualizar) }
  }, [activo, ruta])
  return activo ? total : null
}
