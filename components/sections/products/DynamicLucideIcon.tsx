'use client'

/**
 * DynamicLucideIcon — renderiza un icono de Lucide a partir de su nombre
 * (PascalCase, ej: 'ShoppingBag', 'Tag', 'Utensils').
 *
 * Se usa para mostrar `categories.icon` (guardado en la BD como texto con el
 * nombre del icono Lucide). Si el nombre no resuelve, cae a `fallback` o a un
 * icono por defecto.
 *
 * Nota: importa el mapa `icons` de lucide-react, que incluye todos los iconos.
 * Es un costo de bundle aceptable para las secciones de categorías y evita
 * mantener un mapa estático a mano. Si se necesita optimizar, se puede migrar
 * a `next/dynamic` con `dynamicIconImports` más adelante.
 */

import { icons, type LucideProps } from 'lucide-react'

interface DynamicLucideIconProps extends Omit<LucideProps, 'name'> {
  name?: string | null
  fallback?: string
}

export function DynamicLucideIcon({
  name,
  fallback = 'Tag',
  ...props
}: DynamicLucideIconProps) {
  const iconName = (name && (icons as Record<string, any>)[name]) ? name : fallback
  const Icon = (icons as Record<string, any>)[iconName] || (icons as Record<string, any>)[fallback]
  if (!Icon) return null
  return <Icon {...props} />
}

export default DynamicLucideIcon
