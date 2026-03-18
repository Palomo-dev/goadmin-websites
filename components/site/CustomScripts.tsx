'use client'

import { useEffect, useRef } from 'react'

interface CustomScriptsProps {
  scripts: string
}

/**
 * Componente que inyecta scripts personalizados de la organización.
 * Soporta tanto tags <script> completos como JavaScript raw.
 * 
 * Se ejecuta una sola vez al montar (afterInteractive).
 * Cada organización tiene sus propios scripts aislados por su website_settings.
 */
export default function CustomScripts({ scripts }: CustomScriptsProps) {
  const injectedRef = useRef(false)

  useEffect(() => {
    if (!scripts || injectedRef.current) return
    injectedRef.current = true

    // Crear un contenedor temporal para parsear el HTML con scripts
    const container = document.createElement('div')
    container.innerHTML = scripts

    // Extraer y ejecutar todos los <script> tags
    const scriptTags = container.querySelectorAll('script')

    if (scriptTags.length > 0) {
      scriptTags.forEach((original) => {
        const script = document.createElement('script')
        // Copiar atributos (src, async, defer, type, etc.)
        Array.from(original.attributes).forEach((attr) => {
          script.setAttribute(attr.name, attr.value)
        })
        // Copiar contenido inline
        if (original.textContent) {
          script.textContent = original.textContent
        }
        document.head.appendChild(script)
      })
    } else {
      // Si no hay tags <script>, tratar todo como JavaScript raw
      try {
        const script = document.createElement('script')
        script.textContent = scripts
        document.head.appendChild(script)
      } catch (e) {
        console.warn('[CustomScripts] Error al inyectar script:', e)
      }
    }

    // Inyectar elementos no-script (ej: <noscript>, <img> de pixels)
    const nonScriptElements = container.querySelectorAll(':not(script)')
    nonScriptElements.forEach((el) => {
      document.body.appendChild(el.cloneNode(true))
    })
  }, [scripts])

  return null
}
