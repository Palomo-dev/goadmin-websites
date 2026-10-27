'use client'

import { SectionWrapperBase, type SectionWrapperProps } from './SectionWrapperBase'
import { useAjustesVivosSitio } from '@/components/site/AjustesVivosContext'

/** Mezcla los ajustes del sitio en edición (solo preview) sobre los guardados. */
export function SectionWrapperVivo(props: SectionWrapperProps) {
  const vivos = useAjustesVivosSitio()
  const ajustesSitio = vivos ? { ...(props.ajustesSitio ?? {}), ...vivos } : props.ajustesSitio
  return <SectionWrapperBase {...props} ajustesSitio={ajustesSitio} />
}
