/**
 * Sección `transformation · slider` («Antes y después», Radiante; PLANO §3). Reusa el tipo
 * `transformation`: la variante de siempre (`before_after`, del gym) no cambia.
 *
 * Un comparador con divisor arrastrable por par de fotos del dueño. Solo entran pares completos
 * (`normalizarAntesDespues`); sin ninguno no se pinta (en la vista previa, un aviso).
 *
 * Accesible: el divisor es un `input type=range` nativo (flechas, Inicio/Fin, RePág/AvPág y
 * lectores de pantalla); con varios pares, botones para elegir cuál comparar.
 *
 * Sin 'use client': el manifiesto lee `AntesDespues.CONTENT_KEYS`. La interacción vive en
 * `AntesDespuesVista.tsx`.
 */

import { CLAVES_SECCION_TIENDA, normalizarAntesDespues } from '@/lib/website/v2/contrato/seccionesTienda'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { EditorHint } from '../restaurant/EditorHint'
import { AntesDespuesVista } from './AntesDespuesVista'
import { motivoSeccionTiendaVacia, type DatosPaginaTienda } from './datosTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['transformation.slider']

interface AntesDespuesProps {
  content: Record<string, unknown>
  primaryColor?: string
  organization?: { website_settings?: unknown }
  data?: DatosPaginaTienda
}

/** Color de la manija y el de su ícono (negro o blanco, el de más contraste). */
export function coloresManija(
  handleColor: 'acento' | 'primario' | 'blanco',
  primario: string,
  acento: string | null | undefined,
): { fondo: string; icono: string } {
  if (handleColor === 'blanco') return { fondo: '#FFFFFF', icono: '#111111' }
  const fondo = handleColor === 'acento' ? acento || primario : primario
  return { fondo, icono: textoSobreAcentoSiHex(fondo) ?? '#FFFFFF' }
}

export function AntesDespues({ content, primaryColor = '#111111', organization, data }: AntesDespuesProps) {
  const n = normalizarAntesDespues(content)
  if (n.items.length === 0) {
    const vacia = motivoSeccionTiendaVacia('transformation', 'slider', content, data)
    return vacia ? <EditorHint title={vacia.titulo}>{vacia.texto}</EditorHint> : null
  }
  const ajustes = (organization?.website_settings ?? null) as { accent_color?: unknown } | null
  const acento = typeof ajustes?.accent_color === 'string' ? ajustes.accent_color : null

  return (
    <div>
      {(n.title || n.subtitle) && (
        <div className="mb-8 grid gap-4 md:mb-10 md:grid-cols-[1fr_minmax(0,22rem)] md:items-end md:gap-10">
          {n.title ? (
            <h2 className="titulo-legado whitespace-pre-line text-3xl leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
              {n.title}
            </h2>
          ) : (
            <span />
          )}
          {n.subtitle && <p className="titulo-legado text-sm leading-relaxed opacity-75">{n.subtitle}</p>}
        </div>
      )}
      <AntesDespuesVista items={n.items} inicio={n.startPosition} manija={coloresManija(n.handleColor, primaryColor, acento)} />
    </div>
  )
}

AntesDespues.CONTENT_KEYS = CONTENT_KEYS
