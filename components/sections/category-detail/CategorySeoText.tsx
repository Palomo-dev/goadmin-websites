/**
 * F9.4 — Sección category_seo_text.
 *
 * Bloque de texto al pie de la categoría, útil para SEO.
 * No afecta la UI interactiva; es contenido estático indexable.
 *
 * Figma «16 Sitio web», bloque 6 (2026-11-25): acepta párrafos (una línea en blanco los separa),
 * saltos de línea, **negrita** y enlaces `[texto](https://… o /ruta)`. Antes todo salía en un
 * solo párrafo. Sin esas marcas, el texto sale igual que siempre.
 */

import { Fragment, type ReactNode } from 'react'

export const CONTENT_KEYS = ['title', 'content'] as const

interface CategorySeoTextProps {
  content: {
    title?: string
    content?: string
  }
  primaryColor?: string
}

/** Enlace permitido: ruta propia (`/…`), `https://`, `http://` o `mailto:`. Otro = texto. */
function enlaceSeguro(url: string): string | null {
  const t = url.trim()
  return /^(\/(?!\/)|https?:\/\/|mailto:)[^\s]*$/i.test(t) ? t : null
}

/** **negrita** y [texto](enlace) dentro de una línea (sin HTML: React escapa el resto). */
function enLinea(texto: string): ReactNode[] {
  const partes: ReactNode[] = []
  const patron = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let ultimo = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = patron.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index))
    if (m[1] !== undefined) {
      partes.push(<strong key={k++}>{m[1]}</strong>)
    } else {
      const href = enlaceSeguro(m[3])
      const externo = href ? /^https?:\/\//i.test(href) : false
      partes.push(
        href ? (
          <a key={k++} href={href} className="underline underline-offset-2" {...(externo ? { rel: 'noopener noreferrer' } : {})}>
            {m[2]}
          </a>
        ) : (
          m[0]
        ),
      )
    }
    ultimo = m.index + m[0].length
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo))
  return partes
}

/** Párrafos separados por una línea en blanco; dentro, cada salto de línea es un <br>. */
export function parrafosSeo(texto: string): string[][] {
  return texto
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lineas) => lineas.length > 0)
}

export function CategorySeoText({ content }: CategorySeoTextProps) {
  const title = content.title
  const text = content.content

  if (!title && !text) return null

  return (
    <div className="mt-12 pt-8 border-t dark:border-gray-700">
      {title && (
        <h2 className="titulo-legado text-xl font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      )}
      {text && (
        <div className="prose prose-sm dark:prose-invert max-w-3xl text-gray-600 dark:text-gray-400">
          {parrafosSeo(text).map((lineas, i) => (
            <p key={i}>
              {lineas.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {enLinea(l)}
                </Fragment>
              ))}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
