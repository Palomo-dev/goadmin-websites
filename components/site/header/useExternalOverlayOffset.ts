'use client'

import { useState, useEffect } from 'react'

/**
 * Detecta elementos fijos inyectados en el top de la página por herramientas
 * externas (ej: Facebook Events Manager, Pixel Helper) y devuelve su altura
 * para que el header sticky pueda desplazarse debajo de ellos.
 *
 * Sin este offset, el header queda tapado por la barra de la herramienta externa.
 */
export function useExternalOverlayOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    function check() {
      // Buscar elementos fijos en top:0 que no sean nuestro header
      const fixedEls = document.querySelectorAll<HTMLElement>(
        'body > div[style*="position: fixed"], body > div[style*="position:fixed"], body > div[style*="position: fixed !important"], body > iframe[src*="facebook"], body > div[id*="fb"], body > div[class*="fb-"]'
      )

      let maxH = 0
      fixedEls.forEach(el => {
        const rect = el.getBoundingClientRect()
        // Solo considerar elementos pegados al top con altura razonable (10-120px)
        if (rect.top <= 5 && rect.height >= 10 && rect.height <= 120) {
          maxH = Math.max(maxH, rect.bottom)
        }
      })

      // También verificar si el body tiene un padding-top inyectado
      const bodyPadding = parseInt(getComputedStyle(document.body).paddingTop) || 0
      maxH = Math.max(maxH, bodyPadding)

      setOffset(prev => (prev !== maxH ? maxH : prev))
    }

    // Verificar inmediatamente y luego observar cambios en el DOM
    check()
    const observer = new MutationObserver(() => check())
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })

    // Verificar periódicamente por si la herramienta externa tarda en cargar
    const interval = setInterval(check, 1000)

    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [])

  return offset
}
