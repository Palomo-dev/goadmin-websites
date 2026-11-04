'use client'

/**
 * Ícono de una categoría: `categories.icon` si existe en lucide; si no, el automático por el
 * nombre (`iconoPorNombre`); si tampoco, «Tag». Un nombre que no existe en lucide-react
 * (0.454.0) pasa al siguiente candidato: nunca rompe la página.
 */
import { icons, type LucideProps } from 'lucide-react'
import { candidatosIconoCategoria } from '@/lib/website/iconosCategoria'

type MapaIconos = Record<string, React.ComponentType<LucideProps> | undefined>

/** Primer candidato que exista en lucide, o `respaldo`. */
export function nombreIconoCategoria(cat: { icon?: unknown; name?: unknown }, respaldo = 'Tag'): string {
  const mapa = icons as unknown as MapaIconos
  return candidatosIconoCategoria(cat).find((n) => mapa[n]) ?? respaldo
}

export function IconoCategoria({
  cat,
  respaldo = 'Tag',
  ...props
}: Omit<LucideProps, 'name'> & { cat: { icon?: unknown; name?: unknown }; respaldo?: string }) {
  const mapa = icons as unknown as MapaIconos
  const Icono = mapa[nombreIconoCategoria(cat, respaldo)] ?? mapa.Tag
  if (!Icono) return null
  return <Icono {...props} />
}
