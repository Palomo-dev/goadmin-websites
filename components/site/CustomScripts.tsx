'use client'

import { useMemo } from 'react'

interface CustomScriptsProps {
  scripts: string
}

interface ParsedScript {
  id: string
  src?: string
  innerHTML?: string
  async?: boolean
}

interface ParsedNoScript {
  id: string
  innerHTML: string
}

/**
 * Parsea un string de HTML para extraer tags <script> y <noscript>.
 * Usa regex en vez de DOMParser para funcionar también durante SSR.
 */
function parseScripts(html: string): { scripts: ParsedScript[]; noscripts: ParsedNoScript[] } {
  const scripts: ParsedScript[] = []
  const noscripts: ParsedNoScript[] = []

  // Extraer <script ...>contenido</script>
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  let idx = 0

  while ((match = scriptRegex.exec(html)) !== null) {
    const attrsStr = match[1] || ''
    const content = match[2] || ''

    // Extraer atributos
    const srcMatch = attrsStr.match(/src\s*=\s*"([^"]*)"/i)
    const asyncMatch = attrsStr.match(/\basync\b/i)

    scripts.push({
      id: `custom-script-${idx}`,
      src: srcMatch ? srcMatch[1] : undefined,
      innerHTML: content.trim() || undefined,
      async: !!asyncMatch,
    })
    idx++
  }

  // Extraer <noscript ...>contenido</noscript>
  const noscriptRegex = /<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi
  let nidx = 0
  while ((match = noscriptRegex.exec(html)) !== null) {
    noscripts.push({
      id: `custom-noscript-${nidx}`,
      innerHTML: (match[1] || '').trim(),
    })
    nidx++
  }

  return { scripts, noscripts }
}

/**
 * Componente que inyecta scripts personalizados de la organización.
 * Soporta tags <script> completos (inline y con src) y <noscript>.
 *
 * Usa <script> crudo con dangerouslySetInnerHTML para que los scripts aparezcan
 * en el HTML inicial (SSR). Esto es crítico para que crawlers como Meta
 * Events Manager detecten el pixel base code sin necesidad de ejecutar JS.
 *
 * Cada organización tiene sus propios scripts aislados por su website_settings.
 */
export default function CustomScripts({ scripts }: CustomScriptsProps) {
  const parsed = useMemo(() => {
    if (!scripts) return { scripts: [], noscripts: [] }
    return parseScripts(scripts)
  }, [scripts])

  return (
    <>
      {parsed.scripts.map((s) =>
        s.src ? (
          <script
            key={s.id}
            id={s.id}
            src={s.src}
            async={s.async}
          />
        ) : (
          <script
            key={s.id}
            id={s.id}
            dangerouslySetInnerHTML={{ __html: s.innerHTML || '' }}
          />
        )
      )}
      {parsed.noscripts.map((ns) => (
        <noscript
          key={ns.id}
          dangerouslySetInnerHTML={{ __html: ns.innerHTML }}
        />
      ))}
    </>
  )
}
