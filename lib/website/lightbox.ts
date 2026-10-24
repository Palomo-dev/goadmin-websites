import { booleano } from '@/lib/carrusel/opcionesCarrusel'

/** Las galerías no abrían la foto: con la clave ausente se mantiene así. */
export function lightboxActivo(content: Record<string, unknown> | null | undefined): boolean {
  return booleano(content?.lightbox, false)
}
