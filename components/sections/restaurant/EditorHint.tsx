'use client'

/**
 * Aviso que solo se ve en la vista previa del editor (?preview=1). En el sitio
 * público no pinta nada: una sección sin datos se oculta en vez de mostrar
 * contenido de ejemplo.
 */

import { Info } from 'lucide-react'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'

export function EditorHint({ title, children }: { title: string; children?: React.ReactNode }) {
  const isPreview = useIsPreviewMode()
  if (!isPreview) return null
  return (
    <div className="flex gap-3 rounded-lg border-2 border-dashed border-border p-6 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        {children && <div>{children}</div>}
        <p className="text-xs">Este aviso solo aparece en la vista previa del editor.</p>
      </div>
    </div>
  )
}
