'use client'

import { useEffect, useRef } from 'react'

interface VisitTrackerProps {
  organizationId: number
}

/**
 * Componente invisible que registra una visita (page view) en cada
 * navegación del lado del cliente. Genera un session_id persistente
 * en sessionStorage para agrupar page views del mismo usuario.
 *
 * Se renderiza una sola vez en OrganizationLayout y usa el pathname
 * actual para detectar cambios de página.
 */
export function VisitTracker({ organizationId }: VisitTrackerProps) {
  const lastPathRef = useRef<string>('')

  useEffect(() => {
    const trackVisit = async () => {
      const path = window.location.pathname
      if (path === lastPathRef.current) return
      lastPathRef.current = path

      // Generar o recuperar session_id
      let sessionId = sessionStorage.getItem('wv_session_id')
      // `nueva`: la sesión se crea aquí mismo, así que esta es la primera página de la visita.
      // El servidor lo usa para `is_new_visitor` sin tener que buscar la sesión en la base.
      const nueva = !sessionId
      if (!sessionId) {
        sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        sessionStorage.setItem('wv_session_id', sessionId)
      }

      try {
        await fetch('/api/track-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            sessionId,
            nueva,
            pagePath: path,
            referrer: document.referrer || null,
          }),
        })
      } catch {
        // Silencioso — el tracking no debe romper la página
      }
    }

    trackVisit()
  }, [organizationId])

  return null
}
