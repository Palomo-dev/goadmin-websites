import { SectionWrapperBase, claseDe, type SectionWrapperProps } from './SectionWrapperBase'
import { SectionWrapperVivo } from './SectionWrapperVivo'

export { claseDe }

/**
 * La primera sección y el hero dependen de ajustes del encabezado (`first_section_offset_px`,
 * `header_transparent_over_hero`, `header_style`). En la vista previa del editor esos ajustes
 * llegan en vivo por `goadmin:settings`; por eso pasan por un componente cliente que los mezcla.
 * Fuera del preview no hay ajustes vivos y el resultado es idéntico al de siempre.
 */
export function SectionWrapper(props: SectionWrapperProps) {
  if (props.isFirst || props.sectionType === 'hero') return <SectionWrapperVivo {...props} />
  return <SectionWrapperBase {...props} />
}
