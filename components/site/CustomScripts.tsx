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
      // Procesar scripts en orden, esperando carga de scripts externos
      let scriptIndex = 0

      const loadNextScript = () => {
        if (scriptIndex >= scriptTags.length) return

        const original = scriptTags[scriptIndex]
        const script = document.createElement('script')

        // Copiar atributos (src, async, defer, type, etc.)
        Array.from(original.attributes).forEach((attr) => {
          script.setAttribute(attr.name, attr.value)
        })

        // Si tiene src, esperar a que cargue antes del siguiente script
        if (script.hasAttribute('src')) {
          script.onload = () => {
            scriptIndex++
            loadNextScript()
          }
          script.onerror = () => {
            console.warn('[CustomScripts] Error cargando script:', script.src)
            scriptIndex++
            loadNextScript()
          }
        }

        // Copiar contenido inline
        if (original.textContent) {
          script.textContent = original.textContent
        }

        document.head.appendChild(script)

        // Si no tiene src, pasar al siguiente inmediatamente
        if (!script.hasAttribute('src')) {
          scriptIndex++
          loadNextScript()
        }
      }

      loadNextScript()
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
