'use client'

import { useEffect, useState } from 'react'
import { esOrigenEditor, useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { cambiosSedeValidos, type CambioSedeVivo } from '@/lib/menu/cartaPlatos'

const SIN_CAMBIOS: CambioSedeVivo[] = []

/**
 * Cambios de la carta de una sede que el editor del ERP aún no guarda (precio web, agotado,
 * oculto en la sede), enviados con `{ type: 'goadmin:carta-sede', branchId, cambios }`.
 *
 * Solo en modo preview (`?preview=1`) y solo de un origen del editor; solo se aplican si la
 * sede del mensaje es la de esta página. En memoria del iframe: nada se guarda. Fuera del
 * preview devuelve siempre la lista vacía y la carta es la de siempre.
 */
export function useCartaSedeViva(branchId: number | null): CambioSedeVivo[] {
  const isPreview = useIsPreviewMode()
  const [cambios, setCambios] = useState<CambioSedeVivo[]>(SIN_CAMBIOS)

  useEffect(() => {
    if (!isPreview) return
    const handler = (e: MessageEvent) => {
      if (!esOrigenEditor(e.origin)) return
      if (!e.data || typeof e.data !== 'object' || e.data.type !== 'goadmin:carta-sede') return
      const sede = e.data.branchId
      if (sede !== null && sede !== branchId) return
      setCambios(sede === null ? SIN_CAMBIOS : cambiosSedeValidos(e.data.cambios))
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isPreview, branchId])

  return isPreview ? cambios : SIN_CAMBIOS
}
